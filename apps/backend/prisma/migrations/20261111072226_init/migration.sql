-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ATHLETE', 'PROFESSOR', 'ORGANIZER', 'ADMIN');

-- CreateEnum
CREATE TYPE "CompetitionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ONGOING', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BeltRank" AS ENUM ('WHITE', 'BLUE', 'PURPLE', 'BROWN', 'BLACK');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('M', 'F', 'MIXED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('NEEDS_REVIEW', 'CONFIRMED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WeighInResult" AS ENUM ('VALID', 'INVALID_CATEGORY', 'PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('PENDING', 'APPROVED', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FilePurpose" AS ENUM ('CONSENT_DOCUMENT', 'MEDICAL_CERTIFICATE', 'ID_DOCUMENT', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "auth_user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ATHLETE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlete_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "birth_date" TIMESTAMP(3) NOT NULL,
    "belt_rank" "BeltRank" NOT NULL,
    "weight_kg" DECIMAL(5,2),
    "height_cm" INTEGER,
    "academy" TEXT,
    "federation_id" TEXT,
    "medical_cert_url" TEXT,
    "medical_cert_expiry" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professor_assignments" (
    "id" TEXT NOT NULL,
    "professor_id" TEXT NOT NULL,
    "competition_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "professor_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "regulation" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "registration_opens_at" TIMESTAMP(3) NOT NULL,
    "registration_closes_at" TIMESTAMP(3) NOT NULL,
    "cancellation_deadline" TIMESTAMP(3),
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "status" "CompetitionStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "division_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_standard" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "division_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_divisions" (
    "id" TEXT NOT NULL,
    "competition_id" TEXT NOT NULL,
    "division_type_id" TEXT NOT NULL,
    "config" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "event_divisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "competition_id" TEXT NOT NULL,
    "event_division_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "min_age" INTEGER,
    "max_age" INTEGER,
    "min_weight_kg" DECIMAL(5,2),
    "max_weight_kg" DECIMAL(5,2),
    "belt_ranks" "BeltRank"[],
    "gender" "Gender",
    "snapshot_version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "competition_id" TEXT NOT NULL,
    "event_division_id" TEXT NOT NULL,
    "category_id" TEXT,
    "pending_category_id" TEXT,
    "pending_reason" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "declared_weight_kg" DECIMAL(5,2),
    "registration_snapshot" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weigh_ins" (
    "id" TEXT NOT NULL,
    "registration_id" TEXT NOT NULL,
    "weight_kg" DECIMAL(5,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "measured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "measured_by" TEXT NOT NULL,
    "weigh_in_result" "WeighInResult" NOT NULL,
    "notes" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weigh_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_events" (
    "id" TEXT NOT NULL,
    "registration_id" TEXT NOT NULL,
    "from_status" "RegistrationStatus",
    "to_status" "RegistrationStatus" NOT NULL,
    "event_type" TEXT NOT NULL,
    "reason" TEXT,
    "actor_id" TEXT NOT NULL,
    "actor_role" "Role" NOT NULL,
    "competition_id" TEXT NOT NULL,
    "previous_category_id" TEXT,
    "new_category_id" TEXT,
    "weigh_in_id" TEXT,
    "is_exception" BOOLEAN NOT NULL DEFAULT false,
    "exception_scope" TEXT,
    "correlation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_consents" (
    "id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "competition_id" TEXT NOT NULL,
    "registration_id" TEXT,
    "guardian_name" TEXT NOT NULL,
    "guardian_document" TEXT NOT NULL,
    "document_url" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guardian_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_files" (
    "id" TEXT NOT NULL,
    "registration_id" TEXT,
    "competition_id" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "purpose" "FilePurpose" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_auth_user_id_key" ON "users"("auth_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_auth_user_id_idx" ON "users"("auth_user_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "athlete_profiles_user_id_key" ON "athlete_profiles"("user_id");

-- CreateIndex
CREATE INDEX "professor_assignments_competition_id_idx" ON "professor_assignments"("competition_id");

-- CreateIndex
CREATE INDEX "professor_assignments_professor_id_idx" ON "professor_assignments"("professor_id");

-- CreateIndex
CREATE UNIQUE INDEX "professor_assignments_professor_id_competition_id_key" ON "professor_assignments"("professor_id", "competition_id");

-- CreateIndex
CREATE UNIQUE INDEX "competitions_slug_key" ON "competitions"("slug");

-- CreateIndex
CREATE INDEX "competitions_slug_idx" ON "competitions"("slug");

-- CreateIndex
CREATE INDEX "competitions_status_idx" ON "competitions"("status");

-- CreateIndex
CREATE INDEX "competitions_starts_at_idx" ON "competitions"("starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "division_types_code_key" ON "division_types"("code");

-- CreateIndex
CREATE INDEX "event_divisions_competition_id_idx" ON "event_divisions"("competition_id");

-- CreateIndex
CREATE INDEX "event_divisions_division_type_id_idx" ON "event_divisions"("division_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_divisions_competition_id_division_type_id_key" ON "event_divisions"("competition_id", "division_type_id");

-- CreateIndex
CREATE INDEX "categories_competition_id_idx" ON "categories"("competition_id");

-- CreateIndex
CREATE INDEX "categories_event_division_id_idx" ON "categories"("event_division_id");

-- CreateIndex
CREATE INDEX "registrations_competition_id_idx" ON "registrations"("competition_id");

-- CreateIndex
CREATE INDEX "registrations_event_division_id_idx" ON "registrations"("event_division_id");

-- CreateIndex
CREATE INDEX "registrations_category_id_idx" ON "registrations"("category_id");

-- CreateIndex
CREATE INDEX "registrations_status_idx" ON "registrations"("status");

-- CreateIndex
CREATE INDEX "registrations_athlete_id_status_idx" ON "registrations"("athlete_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "registrations_athlete_id_event_division_id_key" ON "registrations"("athlete_id", "event_division_id");

-- CreateIndex
CREATE UNIQUE INDEX "weigh_ins_idempotency_key_key" ON "weigh_ins"("idempotency_key");

-- CreateIndex
CREATE INDEX "weigh_ins_registration_id_idx" ON "weigh_ins"("registration_id");

-- CreateIndex
CREATE INDEX "weigh_ins_measured_by_idx" ON "weigh_ins"("measured_by");

-- CreateIndex
CREATE INDEX "registration_events_registration_id_idx" ON "registration_events"("registration_id");

-- CreateIndex
CREATE INDEX "registration_events_competition_id_idx" ON "registration_events"("competition_id");

-- CreateIndex
CREATE INDEX "registration_events_actor_id_idx" ON "registration_events"("actor_id");

-- CreateIndex
CREATE INDEX "registration_events_created_at_idx" ON "registration_events"("created_at");

-- CreateIndex
CREATE INDEX "guardian_consents_competition_id_idx" ON "guardian_consents"("competition_id");

-- CreateIndex
CREATE INDEX "guardian_consents_registration_id_idx" ON "guardian_consents"("registration_id");

-- CreateIndex
CREATE INDEX "guardian_consents_status_idx" ON "guardian_consents"("status");

-- CreateIndex
CREATE INDEX "guardian_consents_expires_at_idx" ON "guardian_consents"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_consents_athlete_id_competition_id_key" ON "guardian_consents"("athlete_id", "competition_id");

-- CreateIndex
CREATE INDEX "stored_files_registration_id_idx" ON "stored_files"("registration_id");

-- CreateIndex
CREATE INDEX "stored_files_competition_id_idx" ON "stored_files"("competition_id");

-- CreateIndex
CREATE INDEX "stored_files_uploaded_by_idx" ON "stored_files"("uploaded_by");

-- CreateIndex
CREATE INDEX "stored_files_purpose_idx" ON "stored_files"("purpose");

-- AddForeignKey
ALTER TABLE "athlete_profiles" ADD CONSTRAINT "athlete_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professor_assignments" ADD CONSTRAINT "professor_assignments_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professor_assignments" ADD CONSTRAINT "professor_assignments_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_divisions" ADD CONSTRAINT "event_divisions_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_divisions" ADD CONSTRAINT "event_divisions_division_type_id_fkey" FOREIGN KEY ("division_type_id") REFERENCES "division_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_event_division_id_fkey" FOREIGN KEY ("event_division_id") REFERENCES "event_divisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_event_division_id_fkey" FOREIGN KEY ("event_division_id") REFERENCES "event_divisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_pending_category_id_fkey" FOREIGN KEY ("pending_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weigh_ins" ADD CONSTRAINT "weigh_ins_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weigh_ins" ADD CONSTRAINT "weigh_ins_measured_by_fkey" FOREIGN KEY ("measured_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_events" ADD CONSTRAINT "registration_events_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_events" ADD CONSTRAINT "registration_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_consents" ADD CONSTRAINT "guardian_consents_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_consents" ADD CONSTRAINT "guardian_consents_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_consents" ADD CONSTRAINT "guardian_consents_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
