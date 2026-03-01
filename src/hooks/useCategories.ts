/**
 * Hook dan utilitas untuk manajemen kategori arsip.
 * Kategori disimpan di localStorage dengan set default di awal.
 */

import { useState, useEffect } from "react";

const LS_KEY = "arsipku-categories";

const DEFAULT_CATEGORIES = [
    "Administrasi",
    "Keuangan",
    "Kepegawaian",
    "Hukum",
    "Teknis",
    "Surat Masuk",
    "Surat Keluar",
    "Lainnya",
];

export const useCategories = () => {
    const [categories, setCategories] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem(LS_KEY);
            if (saved) return JSON.parse(saved);
        } catch { }
        return DEFAULT_CATEGORIES;
    });

    useEffect(() => {
        localStorage.setItem(LS_KEY, JSON.stringify(categories));
    }, [categories]);

    const addCategory = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed || categories.includes(trimmed)) return false;
        setCategories((prev) => [...prev, trimmed].sort());
        return true;
    };

    const renameCategory = (oldName: string, newName: string) => {
        const trimmed = newName.trim();
        if (!trimmed || categories.includes(trimmed)) return false;
        setCategories((prev) => prev.map((c) => (c === oldName ? trimmed : c)).sort());
        return true;
    };

    const deleteCategory = (name: string) => {
        setCategories((prev) => prev.filter((c) => c !== name));
    };

    const resetToDefault = () => {
        setCategories(DEFAULT_CATEGORIES);
    };

    return { categories, addCategory, renameCategory, deleteCategory, resetToDefault };
};
