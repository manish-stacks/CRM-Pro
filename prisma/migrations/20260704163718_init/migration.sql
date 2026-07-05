-- AlterTable
ALTER TABLE `attendance` ADD COLUMN `isLate` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `lateBy` INTEGER NULL;
