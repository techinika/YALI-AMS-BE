-- AlterTable
ALTER TABLE `User` MODIFY `password` VARCHAR(191) NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX `ActivityLog_userId_idx` ON `ActivityLog`(`userId`);

-- CreateIndex
CREATE INDEX `ActivityLog_model_idx` ON `ActivityLog`(`model`);

-- CreateIndex
CREATE INDEX `State_countryCode_idx` ON `State`(`countryCode`);

-- AddForeignKey
ALTER TABLE `MatchmakingItem` ADD CONSTRAINT `MatchmakingItem_matchedUserId_fkey` FOREIGN KEY (`matchedUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MatchmakingItem` ADD CONSTRAINT `MatchmakingItem_matchedGroupId_fkey` FOREIGN KEY (`matchedGroupId`) REFERENCES `Group`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- RedefineIndex
ALTER TABLE `Organization` DROP FOREIGN KEY `Organization_addedById_fkey`;
CREATE INDEX `Organization_addedById_idx` ON `Organization`(`addedById`);
ALTER TABLE `Organization` ADD CONSTRAINT `Organization_addedById_fkey` FOREIGN KEY (`addedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
