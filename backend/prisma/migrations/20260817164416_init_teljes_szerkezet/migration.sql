-- CreateEnum
CREATE TYPE "Szerepkor" AS ENUM ('DIAK', 'TANAR', 'ADMIN');

-- CreateEnum
CREATE TYPE "ValaszTipus" AS ENUM ('EGYSZERES', 'TOBBSZOROS');

-- CreateEnum
CREATE TYPE "AttemptStatusz" AS ENUM ('FOLYAMATBAN', 'BEFEJEZVE', 'MEGSZAKITVA');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "nev" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "jelszo_hash" TEXT NOT NULL,
    "szerepkor" "Szerepkor" NOT NULL DEFAULT 'DIAK',
    "csoport_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" SERIAL NOT NULL,
    "csoport_neve" TEXT NOT NULL,
    "tanar_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "nev" TEXT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" SERIAL NOT NULL,
    "kategoria_id" INTEGER NOT NULL,
    "kerdes_szovege" TEXT NOT NULL,
    "kep_url" TEXT,
    "magyarazat" TEXT,
    "valasz_tipus" "ValaszTipus" NOT NULL DEFAULT 'EGYSZERES',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "options" (
    "id" SERIAL NOT NULL,
    "kerdes_id" INTEGER NOT NULL,
    "valasz_szovege" TEXT NOT NULL,
    "helyes_e" BOOLEAN NOT NULL DEFAULT false,
    "sorrend" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tests" (
    "id" SERIAL NOT NULL,
    "cim" TEXT NOT NULL,
    "leiras" TEXT,
    "ido_korlat_percben" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_questions" (
    "teszt_id" INTEGER NOT NULL,
    "kerdes_id" INTEGER NOT NULL,
    "sorrend" INTEGER NOT NULL DEFAULT 0,
    "pontszam" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "test_questions_pkey" PRIMARY KEY ("teszt_id","kerdes_id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" SERIAL NOT NULL,
    "diak_id" INTEGER NOT NULL,
    "teszt_id" INTEGER NOT NULL,
    "kezdes_ideje" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "befejezes_ideje" TIMESTAMP(3),
    "osszpontszam" INTEGER,
    "statusz" "AttemptStatusz" NOT NULL DEFAULT 'FOLYAMATBAN',

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_answers" (
    "id" SERIAL NOT NULL,
    "kitoltes_id" INTEGER NOT NULL,
    "kerdes_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_answer_options" (
    "id" SERIAL NOT NULL,
    "diak_valasz_id" INTEGER NOT NULL,
    "opcio_id" INTEGER NOT NULL,

    CONSTRAINT "student_answer_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "student_answers_kitoltes_id_kerdes_id_key" ON "student_answers"("kitoltes_id", "kerdes_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_answer_options_diak_valasz_id_opcio_id_key" ON "student_answer_options"("diak_valasz_id", "opcio_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_csoport_id_fkey" FOREIGN KEY ("csoport_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_tanar_id_fkey" FOREIGN KEY ("tanar_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_kategoria_id_fkey" FOREIGN KEY ("kategoria_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "options" ADD CONSTRAINT "options_kerdes_id_fkey" FOREIGN KEY ("kerdes_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_teszt_id_fkey" FOREIGN KEY ("teszt_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_kerdes_id_fkey" FOREIGN KEY ("kerdes_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_diak_id_fkey" FOREIGN KEY ("diak_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_teszt_id_fkey" FOREIGN KEY ("teszt_id") REFERENCES "tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_answers" ADD CONSTRAINT "student_answers_kitoltes_id_fkey" FOREIGN KEY ("kitoltes_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_answers" ADD CONSTRAINT "student_answers_kerdes_id_fkey" FOREIGN KEY ("kerdes_id") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_answer_options" ADD CONSTRAINT "student_answer_options_diak_valasz_id_fkey" FOREIGN KEY ("diak_valasz_id") REFERENCES "student_answers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_answer_options" ADD CONSTRAINT "student_answer_options_opcio_id_fkey" FOREIGN KEY ("opcio_id") REFERENCES "options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
