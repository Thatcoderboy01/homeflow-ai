CREATE TABLE `ShoppingCart` (
    `id` VARCHAR(191) NOT NULL,
    `householdId` VARCHAR(191) NOT NULL,
    `approvalId` VARCHAR(191) NULL,
    `actionIndex` INTEGER NULL,
    `provider` VARCHAR(40) NOT NULL,
    `status` ENUM('PREPARED', 'HANDED_OFF', 'CANCELLED') NOT NULL DEFAULT 'PREPARED',
    `location` VARCHAR(120) NULL,
    `budgetInr` INTEGER NULL,
    `subtotalInr` INTEGER NULL,
    `feesInr` INTEGER NULL,
    `feesKnown` BOOLEAN NOT NULL DEFAULT false,
    `items` JSON NOT NULL,
    `handoffUrl` VARCHAR(2000) NULL,
    `quoteObservedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ShoppingCart_approvalId_actionIndex_key`(`approvalId`, `actionIndex`),
    INDEX `ShoppingCart_householdId_status_idx`(`householdId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ShoppingCart` ADD CONSTRAINT `ShoppingCart_householdId_fkey`
  FOREIGN KEY (`householdId`) REFERENCES `Household`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ShoppingCart` ADD CONSTRAINT `ShoppingCart_approvalId_fkey`
  FOREIGN KEY (`approvalId`) REFERENCES `ActionApproval`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
