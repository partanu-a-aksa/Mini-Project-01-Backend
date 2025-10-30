/*
  Warnings:

  - You are about to drop the column `points` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `ReferralCode` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReferralUsage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Reward` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."ReferralCode" DROP CONSTRAINT "ReferralCode_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ReferralUsage" DROP CONSTRAINT "ReferralUsage_referralCodeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ReferralUsage" DROP CONSTRAINT "ReferralUsage_referredUserId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ReferralUsage" DROP CONSTRAINT "ReferralUsage_referrerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Reward" DROP CONSTRAINT "Reward_userId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "points";

-- DropTable
DROP TABLE "public"."ReferralCode";

-- DropTable
DROP TABLE "public"."ReferralUsage";

-- DropTable
DROP TABLE "public"."Reward";

-- DropEnum
DROP TYPE "public"."RewardType";
