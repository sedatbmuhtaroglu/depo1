-- CreateEnum
CREATE TYPE "Weekday" AS ENUM (
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY'
);

-- CreateTable
CREATE TABLE "RestaurantWorkingHour" (
  "id" SERIAL NOT NULL,
  "restaurantId" INTEGER NOT NULL,
  "weekday" "Weekday" NOT NULL,
  "isOpen" BOOLEAN NOT NULL DEFAULT true,
  "openTime" VARCHAR(5),
  "closeTime" VARCHAR(5),

  CONSTRAINT "RestaurantWorkingHour_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantWorkingHour_restaurantId_weekday_key"
ON "RestaurantWorkingHour"("restaurantId", "weekday");

-- CreateIndex
CREATE INDEX "RestaurantWorkingHour_restaurantId_idx"
ON "RestaurantWorkingHour"("restaurantId");

-- AddForeignKey
ALTER TABLE "RestaurantWorkingHour"
ADD CONSTRAINT "RestaurantWorkingHour_restaurantId_fkey"
FOREIGN KEY ("restaurantId")
REFERENCES "Restaurant"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

-- Backfill: existing single opening/closing hour values are copied to all weekdays.
WITH normalized AS (
  SELECT
    r."id" AS restaurant_id,
    CASE
      WHEN r."openingHour" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' THEN r."openingHour"
      ELSE '00:00'
    END AS open_time,
    CASE
      WHEN r."closingHour" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' THEN r."closingHour"
      ELSE '23:59'
    END AS close_time
  FROM "Restaurant" r
),
safe_hours AS (
  SELECT
    restaurant_id,
    CASE WHEN open_time < close_time THEN open_time ELSE '00:00' END AS open_time,
    CASE WHEN open_time < close_time THEN close_time ELSE '23:59' END AS close_time
  FROM normalized
)
INSERT INTO "RestaurantWorkingHour" ("restaurantId", "weekday", "isOpen", "openTime", "closeTime")
SELECT
  s.restaurant_id,
  d.weekday,
  true,
  s.open_time,
  s.close_time
FROM safe_hours s
CROSS JOIN (
  VALUES
    ('MONDAY'::"Weekday"),
    ('TUESDAY'::"Weekday"),
    ('WEDNESDAY'::"Weekday"),
    ('THURSDAY'::"Weekday"),
    ('FRIDAY'::"Weekday"),
    ('SATURDAY'::"Weekday"),
    ('SUNDAY'::"Weekday")
) AS d(weekday)
ON CONFLICT ("restaurantId", "weekday") DO NOTHING;
