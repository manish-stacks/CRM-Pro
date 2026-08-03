-- Adds the FCM push columns to users + clients.
-- Run this OR simply run:  npx prisma db push   (then: npx prisma generate)
--
-- fcmToken is TEXT on purpose: FCM registration tokens are 150–250+ chars and
-- Google does not guarantee a maximum length, so VARCHAR(191) would truncate
-- them and every push would silently fail.

ALTER TABLE `users`
  ADD COLUMN `fcmToken`     TEXT         NULL AFTER `expoPushToken`,
  ADD COLUMN `pushPlatform` VARCHAR(20)  NULL AFTER `fcmToken`,
  ADD COLUMN `pushTokenAt`  DATETIME(3)  NULL AFTER `pushPlatform`;

ALTER TABLE `clients`
  ADD COLUMN `fcmToken`     TEXT         NULL AFTER `expoPushToken`,
  ADD COLUMN `pushPlatform` VARCHAR(20)  NULL AFTER `fcmToken`,
  ADD COLUMN `pushTokenAt`  DATETIME(3)  NULL AFTER `pushPlatform`;

-- Old Expo tokens stay where they are; the app replaces them with an FCM token
-- on the next login, and the sender falls back to Expo until that happens.
-- If you want a hard cut-over instead, uncomment:
-- UPDATE `users`   SET `expoPushToken` = NULL;
-- UPDATE `clients` SET `expoPushToken` = NULL;
