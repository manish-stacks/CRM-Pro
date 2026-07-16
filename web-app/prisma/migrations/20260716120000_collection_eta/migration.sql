ALTER TABLE `leads`
  ADD COLUMN `meetingLat` DOUBLE NULL,
  ADD COLUMN `meetingLng` DOUBLE NULL;

ALTER TABLE `payments` ADD COLUMN `collectedById` VARCHAR(191) NULL;
CREATE INDEX `payments_collectedById_idx` ON `payments`(`collectedById`);
CREATE INDEX `payments_method_idx` ON `payments`(`method`);
ALTER TABLE `payments` ADD CONSTRAINT `payments_collectedById_fkey`
  FOREIGN KEY (`collectedById`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE `payments` p
JOIN `invoices` i ON i.id = p.invoiceId
JOIN `clients` c ON c.id = i.clientId
SET p.collectedById = c.marketingPersonId
WHERE p.collectedById IS NULL AND c.marketingPersonId IS NOT NULL;