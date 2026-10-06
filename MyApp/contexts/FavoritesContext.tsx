import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

export type FavoriteItem = {
  id: string;
  name: string;
  imageUrl?: string | null;
  type?: 'design' | 'service';
};

interface FavoritesContextData {
  favorites: FavoriteItem[];
  toggleFavorite: (item: FavoriteItem) => Promise<void>;
  isFavorite: (id: string) => boolean;
  loading: boolean;
}

const FavoritesContext = createContext<FavoritesContextData>({} as FavoritesContextData);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const data = await AsyncStorage.getItem('@nailhouse_favorites');
      if (data) {
        setFavorites(JSON.parse(data));
      }
    } catch (error) {
      console.error('Failed to load favorites', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (item: FavoriteItem) => {
    try {
      let newFavorites = [];
      const exists = favorites.some((f) => f.id === item.id);
      if (exists) {
        newFavorites = favorites.filter((f) => f.id !== item.id);
      } else {
        newFavorites = [...favorites, item];
      }
      setFavorites(newFavorites);
      await AsyncStorage.setItem('@nailhouse_favorites', JSON.stringify(newFavorites));
    } catch (error) {
      console.error('Failed to save favorites', error);
    }
  };

  const isFavorite = (id: string) => favorites.some((f) => f.id === id);

  return (
    <FavoritesContext.Provider value={{ favorites, toggleFavorite, isFavorite, loading }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export const useFavorites = () => useContext(FavoritesContext);
