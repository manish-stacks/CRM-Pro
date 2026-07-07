-- AlterTable
ALTER TABLE `clients` ADD COLUMN `resetOtp` VARCHAR(191) NULL,
    ADD COLUMN `resetOtpAttempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `resetOtpExpiry` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `resetOtp` VARCHAR(191) NULL,
    ADD COLUMN `resetOtpAttempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `resetOtpExpiry` DATETIME(3) NULL;
