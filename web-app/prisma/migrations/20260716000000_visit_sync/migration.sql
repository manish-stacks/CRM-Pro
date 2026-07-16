-- AlterTable
ALTER TABLE `client_visits`
  ADD COLUMN `leadId` VARCHAR(191) NULL,
  ADD COLUMN `createdById` VARCHAR(191) NULL,
  ADD COLUMN `source` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN `outcome` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `client_visits_leadId_idx` ON `client_visits`(`leadId`);
CREATE INDEX `client_visits_scheduledDate_idx` ON `client_visits`(`scheduledDate`);
CREATE INDEX `client_visits_createdById_idx` ON `client_visits`(`createdById`);

-- AddForeignKey
ALTER TABLE `client_visits` ADD CONSTRAINT `client_visits_leadId_fkey`
  FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `client_visits` ADD CONSTRAINT `client_visits_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
