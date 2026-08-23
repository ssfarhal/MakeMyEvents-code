import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, Booking } from './api';

type Ctx = {
  bookings: Booking[];
  loading: boolean;
  refresh: () => Promise<void>;
  addBooking: (data: Partial<Booking>) => Promise<void>;
  updateBooking: (id: string, data: Partial<Booking>) => Promise<void>;
  deleteBooking: (id: string) => Promise<void>;
  seed: () => Promise<void>;
};

const BookingsContext = createContext<Ctx>({} as any);
export const useBookings = () => useContext(BookingsContext);

export function BookingsProvider({ children }: { children: React.ReactNode }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listBookings();
      setBookings((data || []).sort((a: Booking, b: Booking) => a.eventDate.localeCompare(b.eventDate)));
    } catch (e) {
      console.warn('listBookings', e);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const addBooking = useCallback(async (data: Partial<Booking>) => {
    const created = await api.createBooking(data);
    setBookings((prev) => [...prev, created].sort((a, b) => a.eventDate.localeCompare(b.eventDate)));
  }, []);

  const updateBooking = useCallback(async (id: string, data: Partial<Booking>) => {
    const updated = await api.updateBooking(id, data);
    setBookings((prev) => prev.map((b) => (b.id === id ? updated : b)));
  }, []);

  const deleteBooking = useCallback(async (id: string) => {
    await api.deleteBooking(id);
    setBookings((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const seed = useCallback(async () => {
    const seeded = await api.seed();
    setBookings((seeded || []).sort((a: Booking, b: Booking) => a.eventDate.localeCompare(b.eventDate)));
  }, []);

  return (
    <BookingsContext.Provider value={{ bookings, loading, refresh, addBooking, updateBooking, deleteBooking, seed }}>
      {children}
    </BookingsContext.Provider>
  );
}
