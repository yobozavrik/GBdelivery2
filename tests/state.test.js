import { describe, it, expect } from 'vitest';
import { AppState } from '../src/state.js';

describe('AppState', () => {
  it('notifies adapter when screen changes', () => {
    const updates = [];
    const adapter = { update: (state) => updates.push({ screen: state.screen, tab: state.tab }) };
    const state = new AppState(adapter);

    state.setScreen('drafts-list', { isUnloading: true });
    state.setTab('history');

    expect(updates.length).toBe(2);
    expect(updates[0].screen).toBe('drafts-list');
    expect(state.isUnloading).toBe(true);
    expect(state.tab).toBe('history');
  });

  it('limits batch items to twenty entries', () => {
    const state = new AppState();
    for (let i = 0; i < 20; i++) {
      state.addBatchItem({ id: i });
    }
    expect(state.getBatchCount()).toBe(20);
    expect(() => state.addBatchItem({ id: 21 })).toThrowError();
  });

  it('manages selectedFile state', () => {
    const state = new AppState();
    expect(state.selectedFile).toBeNull();
    const mockFile = new Blob(['test'], { type: 'image/webp' });
    state.setSelectedFile(mockFile);
    expect(state.selectedFile).toBe(mockFile);
    state.setSelectedFile(null);
    expect(state.selectedFile).toBeNull();
  });

  it('manages receipt photo state', () => {
    const state = new AppState();
    expect(state.receiptPhotoFile).toBeNull();
    expect(state.receiptPhotoSource).toBeNull();
    const mockReceiptFile = new Blob(['receipt'], { type: 'image/jpeg' });
    state.setReceiptPhoto(mockReceiptFile, 'camera');
    expect(state.receiptPhotoFile).toBe(mockReceiptFile);
    expect(state.receiptPhotoSource).toBe('camera');
    state.setReceiptPhoto(null, null);
    expect(state.receiptPhotoFile).toBeNull();
    expect(state.receiptPhotoSource).toBeNull();
  });

  it('manages recognizedItems state', () => {
    const state = new AppState();
    expect(state.recognizedItems).toEqual([]);
    const mockItems = [{ id: '1', name: 'Item 1' }];
    state.setRecognizedItems(mockItems);
    expect(state.recognizedItems).toEqual(mockItems);
    state.setRecognizedItems([]);
    expect(state.recognizedItems).toEqual([]);
  });

  it('manages editingRecognizedIndex state', () => {
    const state = new AppState();
    expect(state.editingRecognizedIndex).toBeNull();
    state.setEditingRecognizedIndex(5);
    expect(state.editingRecognizedIndex).toBe(5);
    state.setEditingRecognizedIndex(null);
    expect(state.editingRecognizedIndex).toBeNull();
  });

  it('manages currentViewedItem state', () => {
    const state = new AppState();
    expect(state.currentViewedItem).toEqual({ storeName: null, item: null });
    const mockItem = { id: 'abc', productName: 'Test Product' };
    state.setCurrentViewedItem('Test Store', mockItem);
    expect(state.currentViewedItem).toEqual({ storeName: 'Test Store', item: mockItem });
    state.setCurrentViewedItem(null, null);
    expect(state.currentViewedItem).toEqual({ storeName: null, item: null });
  });
});
