import { createAdminClient } from "@/lib/db/admin";
import { query } from "@/lib/db/pool";
import webpush from "web-push";

function adminClient() {
  return createAdminClient();
}

/**
 * Send push notification when a shift is assigned to a volunteer
 * Respects user notification preferences (enabled, reminder time, timezone)
 */
export async function sendShiftAssignmentNotification(
  userId: string,
  shiftData: {
    eventTitle: string;
    roleName: string;
    startTime: string;
    location?: string;
  }
) {
  try {
    const admin = adminClient();

    // Get user's notification preferences
    const { data: prefs } = await admin
      .from("user_notification_preferences")
      .select("enabled")
      .eq("user_id", userId)
      .single();

    // If notifications disabled, skip
    if (!prefs?.enabled) {
      console.log(`Notifications disabled for user ${userId}`);
      return;
    }

    // Get user's push subscription
    const { data: subscription } = await admin
      .from("user_preferences")
      .select("push_subscription")
      .eq("user_id", userId)
      .not("push_subscription", "is", null)
      .single();

    if (!subscription?.push_subscription) {
      console.log(`No push subscription found for user ${userId}`);
      return;
    }

    // Configure web-push
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );

    // Format shift start time
    const shiftDate = new Date(shiftData.startTime);
    const formattedTime = shiftDate.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Send notification
    await webpush.sendNotification(
      subscription.push_subscription,
      JSON.stringify({
        title: "New Shift Assigned!",
        body: `${shiftData.eventTitle} - ${shiftData.roleName} on ${formattedTime}`,
        data: {
          url: "/volunteer",
          shift_info: {
            event: shiftData.eventTitle,
            role: shiftData.roleName,
            time: shiftData.startTime,
            location: shiftData.location,
          },
        },
        tag: `shift-assignment-${userId}`,
        requireInteraction: false,
      })
    );

    console.log(`Shift assignment notification sent to ${userId}`);
    return true;
  } catch (error) {
    console.error("Error sending shift assignment notification:", error);
    // Don't throw - notification failure shouldn't break the assignment
    return false;
  }
}

/**
 * Send push notification for shift reminders based on user preferences
 * Called by cron function
 */
export async function sendShiftReminders() {
  try {
    const admin = adminClient();

    // Get all users with notifications enabled
    const { data: prefs } = await admin
      .from("user_notification_preferences")
      .select("user_id, reminder_minutes_before, timezone, enabled")
      .eq("enabled", true);

    if (!prefs || prefs.length === 0) {
      console.log("No users with notifications enabled");
      return { sent: 0 };
    }

    let sentCount = 0;

    // For each user, find upcoming shifts that should trigger reminders
    for (const pref of prefs) {
      try {
        // Get user's push subscription
        const { data: subscription } = await admin
          .from("user_preferences")
          .select("push_subscription")
          .eq("user_id", pref.user_id)
          .not("push_subscription", "is", null)
          .single();

        if (!subscription?.push_subscription) {
          continue;
        }

        // Get user's timezone (default to UTC if not set)
        const userTz = pref.timezone || "UTC";
        const reminderMinutes = pref.reminder_minutes_before || 1440;

        // Calculate time windows in user's timezone
        const now = new Date();
        const reminderTime = new Date(now.getTime() + reminderMinutes * 60000);

        // Find shifts that should be reminded now
        const windowEnd = new Date(reminderTime.getTime() + 60000).toISOString();
        const { rows: shifts } = await query<{
          id: string;
          role_name: string;
          start_time: string;
          event_title: string;
          event_location: string | null;
        }>(
          `SELECT sa.id, ss.role_name, COALESCE(ss.start_time, e.start_time) AS start_time,
                  e.title AS event_title, e.location AS event_location
           FROM shift_assignments sa
           JOIN sub_shifts ss ON ss.id = sa.sub_shift_id
           JOIN events e ON e.id = ss.event_id
           WHERE sa.user_id = $1 AND sa.status = 'confirmed'
             AND COALESCE(ss.start_time, e.start_time) >= $2::timestamptz
             AND COALESCE(ss.start_time, e.start_time) <= $3::timestamptz`,
          [pref.user_id, reminderTime.toISOString(), windowEnd]
        );

        if (!shifts.length) {
          continue;
        }

        // Send reminders
        webpush.setVapidDetails(
          process.env.VAPID_SUBJECT!,
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
          process.env.VAPID_PRIVATE_KEY!
        );

        for (const shift of shifts) {
          const shiftDate = new Date(shift.start_time);
          const formattedTime = shiftDate.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: userTz,
          });

          await webpush.sendNotification(
            subscription.push_subscription,
            JSON.stringify({
              title: "Shift Reminder",
              body: `${shift.event_title} - ${shift.role_name} at ${formattedTime}`,
              data: {
                url: "/volunteer",
                shift_info: {
                  event: shift.event_title,
                  role: shift.role_name,
                  time: shift.start_time,
                  location: shift.event_location,
                },
              },
              tag: `shift-reminder-${shift.id}`,
              requireInteraction: false,
            })
          );

          sentCount++;
        }
      } catch (error) {
        console.error(`Error processing reminders for user ${pref.user_id}:`, error);
        // Continue processing other users
      }
    }

    console.log(`Sent ${sentCount} shift reminder notifications`);
    return { sent: sentCount };
  } catch (error) {
    console.error("Error in sendShiftReminders:", error);
    throw error;
  }
}
