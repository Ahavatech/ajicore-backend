-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "last_maintenance_date" TIMESTAMP(3),
ADD COLUMN     "next_scheduled_maintenance" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "fleet_repairs" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "business_id" TEXT NOT NULL,
    "repair_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cost" DOUBLE PRECISION,
    "completion_date" TIMESTAMP(3) NOT NULL,
    "miles_at_service" INTEGER,
    "notes" TEXT,
    "created_by" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fleet_repairs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "fleet_repairs" ADD CONSTRAINT "fleet_repairs_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_repairs" ADD CONSTRAINT "fleet_repairs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
