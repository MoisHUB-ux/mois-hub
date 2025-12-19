import { Toast } from './toast';

export class ErrorHandler {
  static handle(error, context = '') {
    console.error(`Error in ${context}:`, error);

    let message = 'Произошла ошибка';

    if (error.message) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error.error?.message) {
      message = error.error.message;
    }

    // Специфичные ошибки Supabase
    if (error.code === 'PGRST116') {
      message = 'Данные не найдены';
    } else if (error.code === '23505') {
      message = 'Такая запись уже существует';
    } else if (error.code === '42501') {
      message = 'Недостаточно прав доступа';
    }

    Toast.error(message);
    return message;
  }

  static handleNetworkError() {
    Toast.error('Ошибка сети. Проверьте подключение к интернету');
  }

  static handleAuthError() {
    Toast.error('Ошибка авторизации. Пожалуйста, войдите снова');
  }

  static handleValidationError(fields) {
    const message = Array.isArray(fields) 
      ? `Проверьте поля: ${fields.join(', ')}`
      : 'Проверьте заполненные данные';
    Toast.warning(message);
  }
}