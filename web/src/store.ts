import { combineReducers, configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { persistReducer, persistStore } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

export type WorkspaceSection = 'overview' | 'customers' | 'orders' | 'logistics' | 'warehouse' | 'finance' | 'staff';
type Preferences = { selectedSection: WorkspaceSection; orderFilter: 'all' | 'buy' | 'transport'; userId: string | null };
const initialState: Preferences = { selectedSection: 'overview', orderFilter: 'all', userId: null };
const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    setSection: (state, action: PayloadAction<WorkspaceSection>) => { state.selectedSection = action.payload; },
    setOrderFilter: (state, action: PayloadAction<Preferences['orderFilter']>) => { state.orderFilter = action.payload; },
    setPreferenceUser: (state, action: PayloadAction<string>) => {
      if (state.userId !== action.payload) {
        state.userId = action.payload;
        state.selectedSection = 'overview';
        state.orderFilter = 'all';
      }
    },
  },
});
const persisted = persistReducer({ key: 'crm-preferences', storage, whitelist: ['preferences'] }, combineReducers({ preferences: preferencesSlice.reducer }));
export const store = configureStore({ reducer: persisted, middleware: (getDefault) => getDefault({ serializableCheck: false }) });
export const persistor = persistStore(store);
export const { setSection, setOrderFilter, setPreferenceUser } = preferencesSlice.actions;
export type RootState = ReturnType<typeof store.getState>;
