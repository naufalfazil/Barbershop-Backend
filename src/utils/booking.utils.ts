export const SHOP_OPEN_MINUTES = 10 * 60;  // 10.00
export const SHOP_CLOSE_MINUTES = 22 * 60; // 22.00
export const BOOKING_BUFFER_MINUTES = 30;

// Mengubah format HH:mm menjadi total menit
export const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
};

// Mengubah total menit menjadi format HH:mm
export const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return `${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(2, "0")}`;
};

// Menghitung jam selesai layanan
export const calculateEndTime = (
    startTime: string,
    durationMinutes: number
): string => {
    return minutesToTime(timeToMinutes(startTime) + durationMinutes);
};

// Menghitung waktu barber tersedia kembali
export const calculateAvailableTime = (
    startTime: string,
    durationMinutes: number
): string => {
    return minutesToTime(
        timeToMinutes(startTime) + durationMinutes + BOOKING_BUFFER_MINUTES
    );
};

// Memeriksa jam operasional toko
export const isWithinOperatingHours = (
    startTime: string,
    durationMinutes: number
): boolean => {
    const start = timeToMinutes(startTime);
    const end = start + durationMinutes;

    return (
        start >= SHOP_OPEN_MINUTES &&
        end + BOOKING_BUFFER_MINUTES <= SHOP_CLOSE_MINUTES
    );
};

// Memeriksa apakah dua jadwal bertabrakan
export const isScheduleOverlap = (
    newStart: number,
    newEndWithBuffer: number,
    existingStart: number,
    existingEndWithBuffer: number
): boolean => {
    return (
        newStart < existingEndWithBuffer &&
        newEndWithBuffer > existingStart
    );
};

// Memvalidasi tanggal kalender
export const isValidCalendarDate = (dateString: string): boolean => {
    const [year, month, day] = dateString.split("-").map(Number);

    const date = new Date(year, month - 1, day);

    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );
};
