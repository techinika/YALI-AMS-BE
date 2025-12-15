/*
  Warnings:

  - You are about to drop the column `socials` on the `organization` table. All the data in the column will be lost.
  - You are about to drop the column `organizationEmployedId` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `organizationFoundedId` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `positionInEmployed` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `positionInFounded` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `socials` on the `user` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `user` DROP FOREIGN KEY `User_organizationEmployedId_fkey`;

-- DropForeignKey
ALTER TABLE `user` DROP FOREIGN KEY `User_organizationFoundedId_fkey`;

-- AlterTable
ALTER TABLE `organization` DROP COLUMN `socials`,
    ADD COLUMN `addedById` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user` DROP COLUMN `organizationEmployedId`,
    DROP COLUMN `organizationFoundedId`,
    DROP COLUMN `positionInEmployed`,
    DROP COLUMN `positionInFounded`,
    DROP COLUMN `socials`;

-- CreateTable
CREATE TABLE `Organization_WorkingSector` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` INTEGER NULL,
    `workingSectorId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Organization_WorkingSector_id_key`(`id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User_Organization` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` INTEGER NULL,
    `userId` VARCHAR(191) NOT NULL,
    `relation` VARCHAR(191) NOT NULL DEFAULT 'founded',
    `position` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_Organization_id_key`(`id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Organization` ADD CONSTRAINT `Organization_addedById_fkey` FOREIGN KEY (`addedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Organization_WorkingSector` ADD CONSTRAINT `Organization_WorkingSector_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Organization_WorkingSector` ADD CONSTRAINT `Organization_WorkingSector_workingSectorId_fkey` FOREIGN KEY (`workingSectorId`) REFERENCES `WorkingSector`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Organization_WorkingSector` ADD CONSTRAINT `Organization_WorkingSector_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User_Organization` ADD CONSTRAINT `User_Organization_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `User_Organization` ADD CONSTRAINT `User_Organization_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
