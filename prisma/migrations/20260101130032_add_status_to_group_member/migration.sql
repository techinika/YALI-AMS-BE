-- AlterTable
ALTER TABLE `GroupMember` ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'admin_approval_pending';

-- AlterTable
ALTER TABLE `matchmakingrequest` MODIFY `aiSummary` VARCHAR(191) NULL,
    MODIFY `aiNotes` VARCHAR(191) NULL,
    MODIFY `aiResponse` VARCHAR(191) NULL;
