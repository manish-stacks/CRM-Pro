-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'EMPLOYEE',
    `avatar` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `altPhone` VARCHAR(191) NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `disabledAt` DATETIME(3) NULL,
    `disabledReason` VARCHAR(191) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `expoPushToken` VARCHAR(191) NULL,
    `resetOtp` VARCHAR(191) NULL,
    `resetOtpExpiry` DATETIME(3) NULL,
    `resetOtpAttempts` INTEGER NOT NULL DEFAULT 0,
    `loginOtp` VARCHAR(191) NULL,
    `loginOtpExpiry` DATETIME(3) NULL,
    `loginOtpAttempts` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_email_idx`(`email`),
    INDEX `users_role_idx`(`role`),
    INDEX `users_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_activities` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `loginAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `logoutAt` DATETIME(3) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `device` VARCHAR(191) NULL,
    `browser` VARCHAR(191) NULL,
    `os` VARCHAR(191) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `location` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'SUCCESS',

    INDEX `login_activities_userId_loginAt_idx`(`userId`, `loginAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activity_logs` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `changes` TEXT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activity_logs_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `activity_logs_entityType_entityId_idx`(`entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departments` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `color` VARCHAR(191) NULL,
    `icon` VARCHAR(191) NULL,
    `managerId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `departments_name_key`(`name`),
    UNIQUE INDEX `departments_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `department_manager_history` (
    `id` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `managerId` VARCHAR(191) NOT NULL,
    `assignedById` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `removedAt` DATETIME(3) NULL,
    `reason` VARCHAR(191) NULL,

    INDEX `department_manager_history_departmentId_assignedAt_idx`(`departmentId`, `assignedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employees` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NULL,
    `reportingToId` VARCHAR(191) NULL,
    `position` VARCHAR(191) NULL,
    `salary` DOUBLE NOT NULL DEFAULT 0,
    `workMode` VARCHAR(191) NOT NULL DEFAULT 'WFO',
    `joiningDate` DATETIME(3) NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `gender` VARCHAR(191) NULL,
    `bloodGroup` VARCHAR(191) NULL,
    `fatherName` VARCHAR(191) NULL,
    `motherName` VARCHAR(191) NULL,
    `maritalStatus` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `pincode` VARCHAR(191) NULL,
    `emergencyContact` VARCHAR(191) NULL,
    `emergencyPhone` VARCHAR(191) NULL,
    `idProofType` VARCHAR(191) NULL,
    `idProofNumber` VARCHAR(191) NULL,
    `idProofUrl` VARCHAR(191) NULL,
    `panNumber` VARCHAR(191) NULL,
    `aadharNumber` VARCHAR(191) NULL,
    `aadharFrontUrl` VARCHAR(191) NULL,
    `aadharBackUrl` VARCHAR(191) NULL,
    `bankName` VARCHAR(191) NULL,
    `accountNumber` VARCHAR(191) NULL,
    `ifscCode` VARCHAR(191) NULL,
    `accountHolderName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employees_userId_key`(`userId`),
    UNIQUE INDEX `employees_employeeId_key`(`employeeId`),
    INDEX `employees_employeeId_idx`(`employeeId`),
    INDEX `employees_departmentId_idx`(`departmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `letters` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `data` TEXT NOT NULL,
    `generatedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `letters_employeeId_idx`(`employeeId`),
    INDEX `letters_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attendance` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `punchIn` DATETIME(3) NULL,
    `punchOut` DATETIME(3) NULL,
    `workMode` VARCHAR(191) NOT NULL DEFAULT 'WFO',
    `status` VARCHAR(191) NOT NULL DEFAULT 'PRESENT',
    `hoursWorked` DOUBLE NULL,
    `notes` VARCHAR(191) NULL,
    `isLate` BOOLEAN NOT NULL DEFAULT false,
    `lateBy` INTEGER NULL,
    `punchInLat` DOUBLE NULL,
    `punchInLng` DOUBLE NULL,
    `punchInAddress` VARCHAR(191) NULL,
    `punchInIp` VARCHAR(191) NULL,
    `punchInDevice` VARCHAR(191) NULL,
    `punchInBrowser` VARCHAR(191) NULL,
    `punchInOs` VARCHAR(191) NULL,
    `punchOutLat` DOUBLE NULL,
    `punchOutLng` DOUBLE NULL,
    `punchOutAddress` VARCHAR(191) NULL,
    `punchOutIp` VARCHAR(191) NULL,
    `punchOutDevice` VARCHAR(191) NULL,
    `punchOutBrowser` VARCHAR(191) NULL,
    `punchOutOs` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `attendance_date_idx`(`date`),
    INDEX `attendance_status_idx`(`status`),
    UNIQUE INDEX `attendance_employeeId_date_key`(`employeeId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `location_pings` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `attendanceId` VARCHAR(191) NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `accuracy` DOUBLE NULL,
    `speed` DOUBLE NULL,
    `heading` DOUBLE NULL,
    `altitude` DOUBLE NULL,
    `address` VARCHAR(191) NULL,
    `battery` INTEGER NULL,
    `isMoving` BOOLEAN NOT NULL DEFAULT false,
    `source` VARCHAR(191) NOT NULL DEFAULT 'foreground',
    `recordedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `location_pings_userId_recordedAt_idx`(`userId`, `recordedAt`),
    INDEX `location_pings_attendanceId_idx`(`attendanceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_visits` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `clientName` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `scheduledDate` DATE NULL,
    `scheduledTime` VARCHAR(191) NULL,
    `checkInAt` DATETIME(3) NULL,
    `checkInLat` DOUBLE NULL,
    `checkInLng` DOUBLE NULL,
    `checkInAddress` VARCHAR(191) NULL,
    `checkOutAt` DATETIME(3) NULL,
    `checkOutLat` DOUBLE NULL,
    `checkOutLng` DOUBLE NULL,
    `durationMins` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `client_visits_userId_scheduledDate_idx`(`userId`, `scheduledDate`),
    INDEX `client_visits_clientId_idx`(`clientId`),
    INDEX `client_visits_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leaves` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `leaveType` VARCHAR(191) NOT NULL DEFAULT 'PAID',
    `duration` VARCHAR(191) NOT NULL DEFAULT 'SINGLE_DAY',
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `days` DOUBLE NOT NULL,
    `hourlyStart` VARCHAR(191) NULL,
    `hourlyEnd` VARCHAR(191) NULL,
    `hourlyHours` DOUBLE NULL,
    `reason` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `rejectionReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `leaves_employeeId_status_idx`(`employeeId`, `status`),
    INDEX `leaves_startDate_endDate_idx`(`startDate`, `endDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leave_balances` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `paidLeaves` DOUBLE NOT NULL DEFAULT 12,
    `sickLeaves` DOUBLE NOT NULL DEFAULT 6,
    `casualLeaves` DOUBLE NOT NULL DEFAULT 6,
    `usedPaid` DOUBLE NOT NULL DEFAULT 0,
    `usedSick` DOUBLE NOT NULL DEFAULT 0,
    `usedCasual` DOUBLE NOT NULL DEFAULT 0,
    `year` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `leave_balances_employeeId_key`(`employeeId`),
    UNIQUE INDEX `leave_balances_employeeId_year_key`(`employeeId`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payslips` (
    `id` VARCHAR(191) NOT NULL,
    `employeeId` VARCHAR(191) NOT NULL,
    `month` INTEGER NOT NULL,
    `year` INTEGER NOT NULL,
    `basicSalary` DOUBLE NOT NULL DEFAULT 0,
    `hra` DOUBLE NOT NULL DEFAULT 0,
    `conveyance` DOUBLE NOT NULL DEFAULT 0,
    `medical` DOUBLE NOT NULL DEFAULT 0,
    `specialAllow` DOUBLE NOT NULL DEFAULT 0,
    `otherEarnings` DOUBLE NOT NULL DEFAULT 0,
    `grossSalary` DOUBLE NOT NULL DEFAULT 0,
    `pf` DOUBLE NOT NULL DEFAULT 0,
    `esi` DOUBLE NOT NULL DEFAULT 0,
    `tds` DOUBLE NOT NULL DEFAULT 0,
    `professionTax` DOUBLE NOT NULL DEFAULT 0,
    `otherDeduct` DOUBLE NOT NULL DEFAULT 0,
    `totalDeduct` DOUBLE NOT NULL DEFAULT 0,
    `netSalary` DOUBLE NOT NULL DEFAULT 0,
    `workingDays` INTEGER NOT NULL DEFAULT 0,
    `presentDays` DOUBLE NOT NULL DEFAULT 0,
    `halfDays` DOUBLE NOT NULL DEFAULT 0,
    `leaveDays` DOUBLE NOT NULL DEFAULT 0,
    `lopDays` DOUBLE NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `paidAt` DATETIME(3) NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `paymentRef` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payslips_month_year_idx`(`month`, `year`),
    UNIQUE INDEX `payslips_employeeId_month_year_key`(`employeeId`, `month`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leads` (
    `id` VARCHAR(191) NOT NULL,
    `leadNumber` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NULL,
    `clientName` VARCHAR(191) NOT NULL,
    `clientPhone` VARCHAR(191) NOT NULL,
    `clientEmail` VARCHAR(191) NULL,
    `alternatePhone` VARCHAR(191) NULL,
    `link` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'WEBSITE',
    `service` VARCHAR(191) NULL,
    `productPitched` VARCHAR(191) NULL,
    `price` DOUBLE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'NEW',
    `remark` TEXT NULL,
    `notes` TEXT NULL,
    `followUpDate` DATETIME(3) NULL,
    `followUpTime` VARCHAR(191) NULL,
    `meetingDate` DATETIME(3) NULL,
    `meetingTime` VARCHAR(191) NULL,
    `meetingSlot` VARCHAR(191) NULL,
    `meetingLocation` VARCHAR(191) NULL,
    `meetingNotes` TEXT NULL,
    `meetingAssignedToId` VARCHAR(191) NULL,
    `convertedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `closeReason` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `assignedToId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `leads_leadNumber_key`(`leadNumber`),
    INDEX `leads_status_idx`(`status`),
    INDEX `leads_source_idx`(`source`),
    INDEX `leads_assignedToId_idx`(`assignedToId`),
    INDEX `leads_createdById_idx`(`createdById`),
    INDEX `leads_meetingAssignedToId_idx`(`meetingAssignedToId`),
    INDEX `leads_followUpDate_idx`(`followUpDate`),
    INDEX `leads_meetingDate_idx`(`meetingDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_activities` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `fromStatus` VARCHAR(191) NULL,
    `toStatus` VARCHAR(191) NULL,
    `nextActionDate` DATETIME(3) NULL,
    `nextActionTime` VARCHAR(191) NULL,
    `metadata` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_activities_leadId_createdAt_idx`(`leadId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_assignment_history` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NOT NULL,
    `fromUserId` VARCHAR(191) NULL,
    `toUserId` VARCHAR(191) NOT NULL,
    `assignedById` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_assignment_history_leadId_idx`(`leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proposals` (
    `id` VARCHAR(191) NOT NULL,
    `proposalNumber` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NULL,
    `clientId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `notes` TEXT NULL,
    `discount` DOUBLE NOT NULL DEFAULT 0,
    `discountType` VARCHAR(191) NOT NULL DEFAULT 'FIXED',
    `gstApplicable` BOOLEAN NOT NULL DEFAULT false,
    `gstRate` DOUBLE NOT NULL DEFAULT 18,
    `gstAmount` DOUBLE NOT NULL DEFAULT 0,
    `subtotal` DOUBLE NOT NULL DEFAULT 0,
    `totalAmount` DOUBLE NOT NULL DEFAULT 0,
    `finalAmount` DOUBLE NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `validUntil` DATETIME(3) NULL,
    `shareToken` VARCHAR(191) NULL,
    `viewedAt` DATETIME(3) NULL,
    `respondedAt` DATETIME(3) NULL,
    `whatsappSentAt` DATETIME(3) NULL,
    `emailSentAt` DATETIME(3) NULL,
    `terms` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `proposals_proposalNumber_key`(`proposalNumber`),
    UNIQUE INDEX `proposals_shareToken_key`(`shareToken`),
    INDEX `proposals_status_idx`(`status`),
    INDEX `proposals_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proposal_items` (
    `id` VARCHAR(191) NOT NULL,
    `proposalId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NULL,
    `serviceName` VARCHAR(191) NULL,
    `description` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unitPrice` DOUBLE NOT NULL,
    `total` DOUBLE NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clients` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `leadId` VARCHAR(191) NULL,
    `clientCode` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NOT NULL,
    `clientName` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `altPhone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `pincode` VARCHAR(191) NULL,
    `gstApplicable` BOOLEAN NOT NULL DEFAULT false,
    `gstNo` VARCHAR(191) NULL,
    `onboardingDate` DATE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `expoPushToken` VARCHAR(191) NULL,
    `image` VARCHAR(191) NULL,
    `portalPassword` VARCHAR(191) NULL,
    `portalPasswordSet` BOOLEAN NOT NULL DEFAULT false,
    `lastPortalLoginAt` DATETIME(3) NULL,
    `resetOtp` VARCHAR(191) NULL,
    `resetOtpExpiry` DATETIME(3) NULL,
    `resetOtpAttempts` INTEGER NOT NULL DEFAULT 0,
    `telecallerId` VARCHAR(191) NULL,
    `marketingPersonId` VARCHAR(191) NULL,
    `reportingPersonId` VARCHAR(191) NULL,
    `assignedToId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `clients_userId_key`(`userId`),
    UNIQUE INDEX `clients_leadId_key`(`leadId`),
    UNIQUE INDEX `clients_clientCode_key`(`clientCode`),
    INDEX `clients_status_idx`(`status`),
    INDEX `clients_telecallerId_idx`(`telecallerId`),
    INDEX `clients_marketingPersonId_idx`(`marketingPersonId`),
    INDEX `clients_reportingPersonId_idx`(`reportingPersonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_catalog` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `departmentId` VARCHAR(191) NULL,
    `basePrice` DOUBLE NOT NULL DEFAULT 0,
    `billingCycle` VARCHAR(191) NOT NULL DEFAULT 'ONE_TIME',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `service_catalog_slug_key`(`slug`),
    UNIQUE INDEX `service_catalog_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_services` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `serviceCatalogId` VARCHAR(191) NULL,
    `serviceName` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(191) NULL,
    `departmentId` VARCHAR(191) NULL,
    `startDate` DATE NOT NULL,
    `expiryDate` DATE NULL,
    `amount` DOUBLE NOT NULL DEFAULT 0,
    `billingCycle` VARCHAR(191) NOT NULL DEFAULT 'ONE_TIME',
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `autoRenew` BOOLEAN NOT NULL DEFAULT false,
    `renewalNote` VARCHAR(191) NULL,
    `lastRenewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `client_services_status_idx`(`status`),
    INDEX `client_services_expiryDate_idx`(`expiryDate`),
    INDEX `client_services_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `clientServiceId` VARCHAR(191) NOT NULL,
    `managerId` VARCHAR(191) NULL,
    `memberId` VARCHAR(191) NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'MEMBER',
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `removedAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    INDEX `project_assignments_clientServiceId_isActive_idx`(`clientServiceId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_reports` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `clientServiceId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `reportType` VARCHAR(191) NOT NULL DEFAULT 'TEXT',
    `fileUrl` VARCHAR(191) NULL,
    `fileType` VARCHAR(191) NULL,
    `fileSize` INTEGER NULL,
    `reportPeriod` VARCHAR(191) NULL,
    `reportDate` DATE NOT NULL,
    `content` TEXT NULL,
    `uploadedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `client_reports_clientId_reportDate_idx`(`clientId`, `reportDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `proposalId` VARCHAR(191) NULL,
    `subtotal` DOUBLE NOT NULL DEFAULT 0,
    `discount` DOUBLE NOT NULL DEFAULT 0,
    `discountType` VARCHAR(191) NOT NULL DEFAULT 'FIXED',
    `gstApplicable` BOOLEAN NOT NULL DEFAULT false,
    `gstRate` DOUBLE NOT NULL DEFAULT 18,
    `gstAmount` DOUBLE NOT NULL DEFAULT 0,
    `totalAmount` DOUBLE NOT NULL DEFAULT 0,
    `paidAmount` DOUBLE NOT NULL DEFAULT 0,
    `dueAmount` DOUBLE NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `dueDate` DATE NULL,
    `notes` TEXT NULL,
    `terms` TEXT NULL,
    `paymentLink` VARCHAR(191) NULL,
    `shareToken` VARCHAR(191) NULL,
    `whatsappSentAt` DATETIME(3) NULL,
    `emailSentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `invoices_invoiceNumber_key`(`invoiceNumber`),
    UNIQUE INDEX `invoices_shareToken_key`(`shareToken`),
    INDEX `invoices_status_idx`(`status`),
    INDEX `invoices_clientId_idx`(`clientId`),
    INDEX `invoices_dueDate_idx`(`dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_items` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `serviceName` VARCHAR(191) NULL,
    `description` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unitPrice` DOUBLE NOT NULL,
    `total` DOUBLE NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `amount` DOUBLE NOT NULL,
    `method` VARCHAR(191) NOT NULL DEFAULT 'UPI',
    `reference` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` VARCHAR(191) NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
    `gatewayName` VARCHAR(191) NULL,
    `gatewayRef` VARCHAR(191) NULL,
    `receiptToken` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `payments_receiptToken_key`(`receiptToken`),
    INDEX `payments_invoiceId_idx`(`invoiceId`),
    INDEX `payments_paidAt_idx`(`paidAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_groups` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'DIRECT',
    `avatar` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `departmentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_members` (
    `id` VARCHAR(191) NOT NULL,
    `chatGroupId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'MEMBER',
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leftAt` DATETIME(3) NULL,
    `lastReadAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `chat_members_chatGroupId_userId_key`(`chatGroupId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages` (
    `id` VARCHAR(191) NOT NULL,
    `chatGroupId` VARCHAR(191) NULL,
    `senderId` VARCHAR(191) NOT NULL,
    `receiverId` VARCHAR(191) NULL,
    `content` TEXT NOT NULL,
    `attachmentUrl` VARCHAR(191) NULL,
    `attachmentType` VARCHAR(191) NULL,
    `attachmentName` VARCHAR(191) NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `isEdited` BOOLEAN NOT NULL DEFAULT false,
    `editedAt` DATETIME(3) NULL,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `replyToId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `messages_chatGroupId_createdAt_idx`(`chatGroupId`, `createdAt`),
    INDEX `messages_senderId_idx`(`senderId`),
    INDEX `messages_receiverId_idx`(`receiverId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `support_tickets` (
    `id` VARCHAR(191) NOT NULL,
    `ticketNumber` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `category` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `assignedToId` VARCHAR(191) NULL,
    `resolution` TEXT NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `support_tickets_ticketNumber_key`(`ticketNumber`),
    INDEX `support_tickets_status_idx`(`status`),
    INDEX `support_tickets_clientId_idx`(`clientId`),
    INDEX `support_tickets_assignedToId_idx`(`assignedToId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_tickets` (
    `id` VARCHAR(191) NOT NULL,
    `ticketNumber` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `departmentId` VARCHAR(191) NOT NULL,
    `assignedToId` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `category` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `resolution` TEXT NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `employee_tickets_ticketNumber_key`(`ticketNumber`),
    INDEX `employee_tickets_status_idx`(`status`),
    INDEX `employee_tickets_departmentId_idx`(`departmentId`),
    INDEX `employee_tickets_assignedToId_idx`(`assignedToId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `support_ticket_replies` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `isInternal` BOOLEAN NOT NULL DEFAULT false,
    `attachmentUrl` VARCHAR(191) NULL,
    `attachmentType` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `support_ticket_replies_ticketId_createdAt_idx`(`ticketId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_ticket_replies` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `body` TEXT NOT NULL,
    `attachmentUrl` VARCHAR(191) NULL,
    `attachmentType` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `employee_ticket_replies_ticketId_createdAt_idx`(`ticketId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'info',
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `link` VARCHAR(191) NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_userId_isRead_idx`(`userId`, `isRead`),
    INDEX `notifications_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `whatsapp_logs` (
    `id` VARCHAR(191) NOT NULL,
    `toPhone` VARCHAR(191) NOT NULL,
    `templateName` VARCHAR(191) NOT NULL,
    `params` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `response` TEXT NULL,
    `errorMessage` VARCHAR(191) NULL,
    `referenceType` VARCHAR(191) NULL,
    `referenceId` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `whatsapp_logs_toPhone_idx`(`toPhone`),
    INDEX `whatsapp_logs_referenceType_referenceId_idx`(`referenceType`, `referenceId`),
    INDEX `whatsapp_logs_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_logs` (
    `id` VARCHAR(191) NOT NULL,
    `toEmail` VARCHAR(191) NOT NULL,
    `ccEmail` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NOT NULL,
    `body` LONGTEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `response` TEXT NULL,
    `errorMessage` VARCHAR(191) NULL,
    `referenceType` VARCHAR(191) NULL,
    `referenceId` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `email_logs_toEmail_idx`(`toEmail`),
    INDEX `email_logs_referenceType_referenceId_idx`(`referenceType`, `referenceId`),
    INDEX `email_logs_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `value` TEXT NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'general',
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `settings_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `login_activities` ADD CONSTRAINT `login_activities_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `departments` ADD CONSTRAINT `departments_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `department_manager_history` ADD CONSTRAINT `department_manager_history_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_reportingToId_fkey` FOREIGN KEY (`reportingToId`) REFERENCES `employees`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `letters` ADD CONSTRAINT `letters_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `letters` ADD CONSTRAINT `letters_generatedById_fkey` FOREIGN KEY (`generatedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance` ADD CONSTRAINT `attendance_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `location_pings` ADD CONSTRAINT `location_pings_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_visits` ADD CONSTRAINT `client_visits_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_visits` ADD CONSTRAINT `client_visits_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leaves` ADD CONSTRAINT `leaves_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leave_balances` ADD CONSTRAINT `leave_balances_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payslips` ADD CONSTRAINT `payslips_employeeId_fkey` FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_meetingAssignedToId_fkey` FOREIGN KEY (`meetingAssignedToId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_activities` ADD CONSTRAINT `lead_activities_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_activities` ADD CONSTRAINT `lead_activities_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_assignment_history` ADD CONSTRAINT `lead_assignment_history_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_assignment_history` ADD CONSTRAINT `lead_assignment_history_fromUserId_fkey` FOREIGN KEY (`fromUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_assignment_history` ADD CONSTRAINT `lead_assignment_history_toUserId_fkey` FOREIGN KEY (`toUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_assignment_history` ADD CONSTRAINT `lead_assignment_history_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposals` ADD CONSTRAINT `proposals_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposals` ADD CONSTRAINT `proposals_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposals` ADD CONSTRAINT `proposals_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposal_items` ADD CONSTRAINT `proposal_items_proposalId_fkey` FOREIGN KEY (`proposalId`) REFERENCES `proposals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_telecallerId_fkey` FOREIGN KEY (`telecallerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_marketingPersonId_fkey` FOREIGN KEY (`marketingPersonId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_reportingPersonId_fkey` FOREIGN KEY (`reportingPersonId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_services` ADD CONSTRAINT `client_services_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_services` ADD CONSTRAINT `client_services_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_assignments` ADD CONSTRAINT `project_assignments_clientServiceId_fkey` FOREIGN KEY (`clientServiceId`) REFERENCES `client_services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_assignments` ADD CONSTRAINT `project_assignments_managerId_fkey` FOREIGN KEY (`managerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_assignments` ADD CONSTRAINT `project_assignments_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_reports` ADD CONSTRAINT `client_reports_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_reports` ADD CONSTRAINT `client_reports_clientServiceId_fkey` FOREIGN KEY (`clientServiceId`) REFERENCES `client_services`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_reports` ADD CONSTRAINT `client_reports_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_members` ADD CONSTRAINT `chat_members_chatGroupId_fkey` FOREIGN KEY (`chatGroupId`) REFERENCES `chat_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_members` ADD CONSTRAINT `chat_members_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_chatGroupId_fkey` FOREIGN KEY (`chatGroupId`) REFERENCES `chat_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_receiverId_fkey` FOREIGN KEY (`receiverId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_tickets` ADD CONSTRAINT `employee_tickets_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_tickets` ADD CONSTRAINT `employee_tickets_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_tickets` ADD CONSTRAINT `employee_tickets_departmentId_fkey` FOREIGN KEY (`departmentId`) REFERENCES `departments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_ticket_replies` ADD CONSTRAINT `support_ticket_replies_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_ticket_replies` ADD CONSTRAINT `support_ticket_replies_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_ticket_replies` ADD CONSTRAINT `employee_ticket_replies_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `employee_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_ticket_replies` ADD CONSTRAINT `employee_ticket_replies_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
