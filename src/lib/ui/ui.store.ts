// ================================================================================
// ФАЙЛ: src/lib/ui/ui.store.ts
// Описание: Глобальный стор для управления интерфейсом (Drawer, Modal, Notifications, Confirm, Lightbox)
// ================================================================================

import { writable } from 'svelte/store';

export type DrawerSection = 'providers' | 'design' | 'ai-settings' | 'my-chats' | 'my-searches';
export type ModalId = 'script' | 'extras' | 'export' | 'faq' | 'analytics' | 'lorebook' | 'summarize' | 'logging' | 'import-session' | 'backup' | 'map' | 'autoplay' | 'team-autoplay' | 'eye' | 'support' | 'memorybook' | 'provider-help';
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export type Notification = { 
	id: string; 
	message: string; 
	type: NotificationType;
};

// Тип для глобального диалога подтверждения
export type ConfirmData = { 
	title: string; 
	message: string; 
	confirmText?: string;
	resolve: (value: boolean) => void;
};

export type UIState = {
	drawer: { open: boolean; section: DrawerSection | null };
	modal: { open: boolean; id: ModalId | null };
	notifications: Notification[];
	confirm: ConfirmData | null;
	lightbox: { open: boolean; url: string | null }; // <-- ДОБАВЛЕНО для полноэкранных фото
};

const initial: UIState = {
	drawer: { open: false, section: null },
	modal: { open: false, id: null },
	notifications: [],
	confirm: null,
	lightbox: { open: false, url: null } // <-- ДОБАВЛЕНО
};

function nid() {
	return `ntf_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function createUIStore() {
	const { subscribe, update } = writable<UIState>(initial);
	
	return {
		subscribe,
		
		openDrawer(section: DrawerSection) {
			update((s) => ({
				...s,
				modal: { open: false, id: null },
				drawer: { open: true, section }
			}));
		},
		
		closeDrawer() {
			update((s) => ({ ...s, drawer: { open: false, section: null } }));
		},
		
		openModal(id: ModalId) {
			update((s) => ({
				...s,
				drawer: { open: false, section: null },
				modal: { open: true, id }
			}));
		},
		
		closeModal() {
			update((s) => ({ ...s, modal: { open: false, id: null } }));
		},
		
		closeAll() {
			update((s) => {
				// Если закрываем всё и висит конфирм — резолвим его как false
				if (s.confirm) s.confirm.resolve(false);
				
				return {
					...s,
					drawer: { open: false, section: null },
					modal: { open: false, id: null },
					confirm: null,
					lightbox: { open: false, url: null } // <-- Сбрасываем лайтбокс
				};
			});
		},
		
		notify(message: string, type: NotificationType = 'info') {
			const id = nid();
			update((s) => ({
				...s,
				notifications: [...s.notifications, { id, message, type }]
			}));
			setTimeout(() => {
				update((s) => ({
					...s,
					notifications: s.notifications.filter((n) => n.id !== id)
				}));
			}, 4000);
		},
		
		removeNotification(id: string) {
			update((s) => ({
				...s,
				notifications: s.notifications.filter((n) => n.id !== id)
			}));
		},

		// ================================================================================
		// НОВЫЕ МЕТОДЫ ДЛЯ ГЛОБАЛЬНОГО ПОДТВЕРЖДЕНИЯ (Promise-based Confirm)
		// ================================================================================
		
		/**
		 * Вызов глобального окна подтверждения
		 * Использование: const isOk = await ui.confirm('Внимание', 'Удалить данные?', 'Да, удалить');
		 */
		confirm(title: string, message: string, confirmText?: string): Promise<boolean> {
			return new Promise((resolve) => {
				update((s) => {
					// Если уже есть открытый конфирм, отменяем предыдущий
					if (s.confirm) s.confirm.resolve(false);
					
					return { 
						...s, 
						confirm: { title, message, confirmText, resolve } 
					};
				});
			});
		},
		
		/**
		 * Отмена подтверждения
		 */
		closeConfirm() {
			update((s) => {
				if (s.confirm) s.confirm.resolve(false);
				return { ...s, confirm: null };
			});
		},

		/**
		 * Завершение диалога с переданным значением (true - подтверждено, false - отменено)
		 */
		resolveConfirm(value: boolean) {
			update((s) => {
				if (s.confirm) s.confirm.resolve(value);
				return { ...s, confirm: null };
			});
		},

		// ================================================================================
		// ПРОСМОТРЩИК ПОЛНОЭКРАННЫХ ФОТО (LIGHTBOX)
		// ================================================================================
		openLightbox(url: string) {
			update((s) => ({
				...s,
				lightbox: { open: true, url }
			}));
		},

		closeLightbox() {
			update((s) => ({
				...s,
				lightbox: { open: false, url: null }
			}));
		}
	};
}

export const ui = createUIStore();