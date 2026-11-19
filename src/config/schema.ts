import { mysqlTableWithSchema } from "drizzle-orm/mysql-core";
import { mysqlTable, bigint, varchar, text, decimal, int, tinyint, mysqlEnum, timestamp, date, time } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  idUser: bigint("id_user", {
    mode: "number",
    unsigned: true,
  }).autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  email: varchar("email", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  no_telepon: varchar("no_telepon", { length: 20 }),
  role: mysqlEnum("role", ["customer", "admin", "kasir"])
    .notNull()
    .default("customer"),
  statusAktif: tinyint("status_aktif")
    .notNull()
    .default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
        .defaultNow()
        .onUpdateNow()
        .notNull(),
});

export const pegawaiBarber = mysqlTable("pegawai_barber", {
  idPegawai: bigint("id_pegawai", {
    mode: "number",
    unsigned: true,
  }).autoincrement().primaryKey(),
  idUser: bigint("id_user", {
    mode: "number",
    unsigned: true,
  }).references(() => users.idUser, {
    onDelete: "set null",
    onUpdate: "cascade",
  }).unique(),
  namaPegawai: varchar("nama_pegawai", { length: 100 }).notNull(),
  deskripsi: text("deskripsi"),
  fotoUrl: text("foto_url"),
  fotoPublicId: varchar("foto_public_id", { length: 255 }),
  statusAktif: tinyint("status_aktif").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
        .defaultNow()
        .onUpdateNow()
        .notNull(),
});

export const layanan = mysqlTable("layanan", {
  idLayanan: bigint("id_layanan", {
    mode: "number",
    unsigned: true,
  }).autoincrement().primaryKey(),
  namaLayanan: varchar("nama_layanan", { length: 100 }).notNull(),
  deskripsi: text("deskripsi"),
  harga: decimal("harga", {
    precision: 12,
    scale: 2,
  }).notNull(),
  durasiMenit: int("durasi_menit", { unsigned: true }).notNull(),
  fotoUrl: text("foto_url"),
  fotoPublicId: varchar("foto_public_id", { length: 255 }),
  statusAktif: tinyint("status_aktif").notNull().default(1),
  status: mysqlEnum("status", [
    "published",
    "unavailable",
    "deleted",
  ]).notNull().default("published"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
        .defaultNow()
        .onUpdateNow()
        .notNull(),
});

export const pemesanan = mysqlTable("pemesanan", {
  idPemesanan: bigint("id_pemesanan", {
    mode: "number",
    unsigned: true,
  }).autoincrement().primaryKey(),
  kodePemesanan: varchar("kode_pemesanan", { length: 30 })
    .notNull()
    .unique(),
  idUser: bigint("id_user", {
    mode: "number",
    unsigned: true,
  })
    .notNull()
    .references(() => users.idUser, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  idPegawai: bigint("id_pegawai", {
    mode: "number",
    unsigned: true,
  })
    .notNull()
    .references(() => pegawaiBarber.idPegawai, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  idLayanan: bigint("id_layanan", {
    mode: "number",
    unsigned: true,
  })
    .notNull()
    .references(() => layanan.idLayanan, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  tanggalPemesanan: date("tanggal_pemesanan").notNull(),
  jamMulai: time("jam_mulai").notNull(),
  jamSelesai: time("jam_selesai").notNull(),
  namaLayanan: varchar("nama_layanan", { length: 100 }).notNull(),
  hargaLayanan: decimal("harga_layanan", {
    precision: 12,
    scale: 2,
  }).notNull(),
  durasiMenit: int("durasi_menit", { unsigned: true }).notNull(),
  statusPemesanan: mysqlEnum("status_pemesanan", [
    "awaiting_payment",
    "awaiting_verification",
    "confirmed",
    "completed",
    "no_show",
    "canceled",
    "expired",
  ])
    .notNull()
    .default("awaiting_payment"),
  jumlahReschedule: tinyint("jumlah_reschedule", {
    unsigned: true,
  })
    .notNull()
    .default(0),
  noShowDecision: mysqlEnum("no_show_decision", [
  "not_selected",
  "forfeited",
  "rescheduled",
])
  .notNull()
  .default("not_selected"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
        .defaultNow()
        .onUpdateNow()
        .notNull(),
});

export const pembayaran = mysqlTable("pembayaran", {
  idPembayaran: bigint("id_pembayaran", {
    mode: "number",
    unsigned: true,
  }).autoincrement().primaryKey(),
  idPemesanan: bigint("id_pemesanan", {
    mode: "number",
    unsigned: true,
  })
    .notNull()
    .references(() => pemesanan.idPemesanan, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  jumlahBayar: decimal("jumlah_bayar", {
    precision: 12,
    scale: 2,
  }).notNull(),
  metodePembayaran: mysqlEnum("metode_pembayaran", ["QRIS"])
    .notNull()
    .default("QRIS"),
  buktiPembayaranUrl: text("bukti_pembayaran_url").notNull(),
  buktiPembayaranPublicId: varchar("bukti_pembayaran_public_id", {
    length: 255,
  }).notNull(),
  statusVerifikasi: mysqlEnum("verification_status", [
  "pending",
  "approved",
  "rejected",
])
  .notNull()
  .default("pending"),
  idKasir: bigint("id_kasir", {
    mode: "number",
    unsigned: true,
  }).references(() => users.idUser, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  waktuVerifikasi: timestamp("waktu_verifikasi"),
  alasanPenolakan: text("alasan_penolakan"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const riwayatReschedule = mysqlTable("riwayat_reschedule", {
  idRiwayat: bigint("id_riwayat", {
    mode: "number",
    unsigned: true,
  }).autoincrement().primaryKey(),
  idPemesanan: bigint("id_pemesanan", {
    mode: "number",
    unsigned: true,
  })
    .notNull()
    .references(() => pemesanan.idPemesanan, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  tanggalLama: date("tanggal_lama").notNull(),
  jamMulaiLama: time("jam_mulai_lama").notNull(),
  tanggalBaru: date("tanggal_baru").notNull(),
  jamMulaiBaru: time("jam_mulai_baru").notNull(),
  idUser: bigint("id_user", {
    mode: "number",
    unsigned: true,
  })
    .notNull()
    .references(() => users.idUser, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  alasan: text("alasan"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

