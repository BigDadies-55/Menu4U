export type Lang = "he" | "en" | "ru" | "fr";

export interface Translations {
  // Direction
  dir: "rtl" | "ltr";

  // Guest registration modal (table ordering)
  welcome: string;
  enterDetailsToOrder: string;
  fullName: string;
  phoneNumber: string;
  enter: string;
  nameRequired: string;
  phoneRequired: string;
  phoneInvalid: string;

  // Coupon registration
  get5Percent: string;
  registerGetCoupon: string;
  registerGetCouponSub: string;
  registerBtn: string;
  otpSentTitle: string;
  otpSentSub: string;
  otpValidFor: string;
  otpCode: string;
  verifyBtn: string;
  backToForm: string;
  couponTitle: string;
  couponSub: string;
  couponNote: string;
  closeThanks: string;
  floatingBtn: string;

  // Validation
  nameField: string;
  phoneField: string;
  emailField: string;
  emailInvalid: string;
  otpRequired: string;
  sending: string;
  verifying: string;

  // Errors
  userExists: string;
  registrationError: string;
  verifyError: string;
  otpExpired: string;
  otpWrong: string;

  // Cart / order
  cart: string;
  sendOrder: string;
  orderSent: string;
  orderError: string;
  addNote: string;
  notePlaceholder: string;
  addToCart: string;
  close: string;
  back: string;
  loading: string;
  tableLabel: string;
  myOrders: string;
  allOrders: string;
  myBill: string;
  allBill: string;
  requestBill: string;
  noOrders: string;
  orderNumber: string;
  vegBadge: string;
  veganBadge: string;
  gfBadge: string;

  // Actions
  navigate: string;
  website: string;
  call: string;
}

const he: Translations = {
  dir: "rtl",
  welcome: "ברוך הבא!",
  enterDetailsToOrder: "הזן פרטים כדי להזמין",
  fullName: "שם מלא *",
  phoneNumber: "מספר טלפון *",
  enter: "כניסה",
  nameRequired: "נא להזין שם",
  phoneRequired: "נא להזין מספר טלפון תקין",
  phoneInvalid: "נא להזין מספר טלפון תקין",

  get5Percent: "קבל 5% הנחה לארוחה הבאה!",
  registerGetCoupon: "הירשם ותקבל קוד קופון למייל",
  registerGetCouponSub: "כל מי שרוצה 5% לארוחה מוזמן להירשם",
  registerBtn: "הירשם וקבל קוד →",
  otpSentTitle: "קוד אימות נשלח!",
  otpSentSub: "שלחנו קוד בן 6 ספרות ל",
  otpValidFor: "הקוד תקף ל-15 דקות",
  otpCode: "קוד אימות *",
  verifyBtn: "אמת קוד ←",
  backToForm: "← חזרה לטופס",
  couponTitle: "ברוך הבא לקהילה!",
  couponSub: "הנה קוד ה-5% שלך לארוחה הבאה",
  couponNote: "הצג קוד זה למלצר בסיום הארוחה",
  closeThanks: "תודה, סגור",
  floatingBtn: "כל מי שרוצה 5% לארוחה מוזמן להירשם",

  nameField: "שם מלא *",
  phoneField: "טלפון *",
  emailField: "אימייל *",
  emailInvalid: "אימייל תקין נדרש",
  otpRequired: "יש להזין את הקוד",
  sending: "שולח...",
  verifying: "מאמת...",

  userExists: "משתמש כבר קיים",
  registrationError: "שגיאה בהרשמה",
  verifyError: "שגיאה באימות",
  otpExpired: "הקוד פג תוקף — יש לחזור ולהירשם מחדש",
  otpWrong: "קוד שגוי",

  cart: "סל",
  sendOrder: "שלח הזמנה",
  orderSent: "ההזמנה נשלחה!",
  orderError: "שגיאה בשליחת ההזמנה",
  addNote: "הוסף הערה",
  notePlaceholder: "הערות לבישול...",
  addToCart: "הוסף לסל",
  close: "סגור",
  back: "חזרה",
  loading: "טוען...",
  tableLabel: "שולחן",
  myOrders: "ההזמנות שלי",
  allOrders: "כל ההזמנות",
  myBill: "החשבון שלי",
  allBill: "החשבון המלא",
  requestBill: "בקש חשבון",
  noOrders: "אין הזמנות עדיין",
  orderNumber: "הזמנה",
  vegBadge: "🌿 צמחוני",
  veganBadge: "🌱 טבעוני",
  gfBadge: "ללא גלוטן",

  navigate: "נווט",
  website: "אתר",
  call: "התקשר",
};

const en: Translations = {
  dir: "ltr",
  welcome: "Welcome!",
  enterDetailsToOrder: "Enter your details to order",
  fullName: "Full name *",
  phoneNumber: "Phone number *",
  enter: "Continue",
  nameRequired: "Please enter your name",
  phoneRequired: "Please enter a valid phone number",
  phoneInvalid: "Please enter a valid phone number",

  get5Percent: "Get 5% off your next meal!",
  registerGetCoupon: "Sign up and receive a coupon code by email",
  registerGetCouponSub: "Join us and get 5% off — sign up now",
  registerBtn: "Sign up & get code →",
  otpSentTitle: "Verification code sent!",
  otpSentSub: "We sent a 6-digit code to",
  otpValidFor: "Code valid for 15 minutes",
  otpCode: "Verification code *",
  verifyBtn: "Verify code ←",
  backToForm: "← Back to form",
  couponTitle: "Welcome to the community!",
  couponSub: "Here is your 5% coupon for your next meal",
  couponNote: "Show this code to the waiter at the end of your meal",
  closeThanks: "Thanks, close",
  floatingBtn: "Get 5% off — sign up now",

  nameField: "Full name *",
  phoneField: "Phone *",
  emailField: "Email *",
  emailInvalid: "Valid email required",
  otpRequired: "Please enter the code",
  sending: "Sending...",
  verifying: "Verifying...",

  userExists: "User already registered",
  registrationError: "Registration error",
  verifyError: "Verification error",
  otpExpired: "Code expired — please register again",
  otpWrong: "Wrong code",

  cart: "Cart",
  sendOrder: "Place order",
  orderSent: "Order placed!",
  orderError: "Error placing order",
  addNote: "Add a note",
  notePlaceholder: "Cooking instructions...",
  addToCart: "Add to cart",
  close: "Close",
  back: "Back",
  loading: "Loading...",
  tableLabel: "Table",
  myOrders: "My orders",
  allOrders: "All orders",
  myBill: "My bill",
  allBill: "Full bill",
  requestBill: "Request bill",
  noOrders: "No orders yet",
  orderNumber: "Order",
  vegBadge: "🌿 Vegetarian",
  veganBadge: "🌱 Vegan",
  gfBadge: "Gluten free",

  navigate: "Navigate",
  website: "Website",
  call: "Call",
};

const ru: Translations = {
  dir: "ltr",
  welcome: "Добро пожаловать!",
  enterDetailsToOrder: "Введите данные для заказа",
  fullName: "Полное имя *",
  phoneNumber: "Номер телефона *",
  enter: "Войти",
  nameRequired: "Пожалуйста, введите имя",
  phoneRequired: "Пожалуйста, введите корректный номер",
  phoneInvalid: "Пожалуйста, введите корректный номер",

  get5Percent: "Получите скидку 5% на следующий обед!",
  registerGetCoupon: "Зарегистрируйтесь и получите код купона на email",
  registerGetCouponSub: "Зарегистрируйтесь и получите 5% скидку",
  registerBtn: "Зарегистрироваться →",
  otpSentTitle: "Код подтверждения отправлен!",
  otpSentSub: "Мы отправили 6-значный код на",
  otpValidFor: "Код действителен 15 минут",
  otpCode: "Код подтверждения *",
  verifyBtn: "Подтвердить ←",
  backToForm: "← Назад к форме",
  couponTitle: "Добро пожаловать в сообщество!",
  couponSub: "Ваш купон на 5% для следующего заказа",
  couponNote: "Покажите этот код официанту в конце трапезы",
  closeThanks: "Спасибо, закрыть",
  floatingBtn: "Получите 5% скидку — зарегистрируйтесь",

  nameField: "Полное имя *",
  phoneField: "Телефон *",
  emailField: "Email *",
  emailInvalid: "Требуется корректный email",
  otpRequired: "Пожалуйста, введите код",
  sending: "Отправка...",
  verifying: "Проверка...",

  userExists: "Пользователь уже зарегистрирован",
  registrationError: "Ошибка регистрации",
  verifyError: "Ошибка проверки",
  otpExpired: "Код истёк — пожалуйста, зарегистрируйтесь снова",
  otpWrong: "Неверный код",

  cart: "Корзина",
  sendOrder: "Оформить заказ",
  orderSent: "Заказ принят!",
  orderError: "Ошибка при оформлении заказа",
  addNote: "Добавить примечание",
  notePlaceholder: "Инструкции по приготовлению...",
  addToCart: "Добавить в корзину",
  close: "Закрыть",
  back: "Назад",
  loading: "Загрузка...",
  tableLabel: "Стол",
  myOrders: "Мои заказы",
  allOrders: "Все заказы",
  myBill: "Мой счёт",
  allBill: "Полный счёт",
  requestBill: "Попросить счёт",
  noOrders: "Заказов ещё нет",
  orderNumber: "Заказ",
  vegBadge: "🌿 Вегетарианское",
  veganBadge: "🌱 Веганское",
  gfBadge: "Без глютена",

  navigate: "Навигация",
  website: "Сайт",
  call: "Позвонить",
};

const fr: Translations = {
  dir: "ltr",
  welcome: "Bienvenue !",
  enterDetailsToOrder: "Entrez vos coordonnées pour commander",
  fullName: "Nom complet *",
  phoneNumber: "Numéro de téléphone *",
  enter: "Continuer",
  nameRequired: "Veuillez entrer votre nom",
  phoneRequired: "Veuillez entrer un numéro valide",
  phoneInvalid: "Veuillez entrer un numéro valide",

  get5Percent: "Obtenez 5% de réduction sur votre prochain repas !",
  registerGetCoupon: "Inscrivez-vous et recevez un code coupon par email",
  registerGetCouponSub: "Inscrivez-vous pour obtenir 5% de réduction",
  registerBtn: "S'inscrire et obtenir le code →",
  otpSentTitle: "Code de vérification envoyé !",
  otpSentSub: "Nous avons envoyé un code à 6 chiffres à",
  otpValidFor: "Le code est valable 15 minutes",
  otpCode: "Code de vérification *",
  verifyBtn: "Vérifier le code ←",
  backToForm: "← Retour au formulaire",
  couponTitle: "Bienvenue dans la communauté !",
  couponSub: "Voici votre coupon de 5% pour votre prochain repas",
  couponNote: "Montrez ce code au serveur à la fin de votre repas",
  closeThanks: "Merci, fermer",
  floatingBtn: "Obtenez 5% — inscrivez-vous maintenant",

  nameField: "Nom complet *",
  phoneField: "Téléphone *",
  emailField: "Email *",
  emailInvalid: "Un email valide est requis",
  otpRequired: "Veuillez entrer le code",
  sending: "Envoi...",
  verifying: "Vérification...",

  userExists: "Utilisateur déjà inscrit",
  registrationError: "Erreur d'inscription",
  verifyError: "Erreur de vérification",
  otpExpired: "Code expiré — veuillez vous réinscrire",
  otpWrong: "Code incorrect",

  cart: "Panier",
  sendOrder: "Passer commande",
  orderSent: "Commande passée !",
  orderError: "Erreur lors de la commande",
  addNote: "Ajouter une note",
  notePlaceholder: "Instructions de cuisson...",
  addToCart: "Ajouter au panier",
  close: "Fermer",
  back: "Retour",
  loading: "Chargement...",
  tableLabel: "Table",
  myOrders: "Mes commandes",
  allOrders: "Toutes les commandes",
  myBill: "Mon addition",
  allBill: "Addition complète",
  requestBill: "Demander l'addition",
  noOrders: "Pas encore de commandes",
  orderNumber: "Commande",
  vegBadge: "🌿 Végétarien",
  veganBadge: "🌱 Végétalien",
  gfBadge: "Sans gluten",

  navigate: "Naviguer",
  website: "Site web",
  call: "Appeler",
};

export const TRANSLATIONS: Record<Lang, Translations> = { he, en, ru, fr };

export function getT(lang?: string | null): Translations {
  return TRANSLATIONS[(lang as Lang) ?? "he"] ?? TRANSLATIONS.he;
}

/** Shape stored in Item.translations / Category.translations */
export type ItemTranslations = {
  en?: { name?: string; description?: string };
  ru?: { name?: string; description?: string };
  fr?: { name?: string; description?: string };
};
export type CategoryTranslations = {
  en?: { name?: string };
  ru?: { name?: string };
  fr?: { name?: string };
};

/** Return translated name for an item, fallback to original */
export function getItemName(item: { name: string; translations?: ItemTranslations | null }, lang: string): string {
  if (lang === "he" || !lang) return item.name;
  const t = item.translations as ItemTranslations | null | undefined;
  return t?.[lang as keyof ItemTranslations]?.name?.trim() || item.name;
}

/** Return translated description for an item, fallback to original */
export function getItemDesc(item: { description?: string | null; translations?: ItemTranslations | null }, lang: string): string | null {
  if (lang === "he" || !lang) return item.description ?? null;
  const t = item.translations as ItemTranslations | null | undefined;
  const translated = t?.[lang as keyof ItemTranslations]?.description?.trim();
  return translated || item.description || null;
}

/** Return translated name for a category, fallback to original */
export function getCatName(cat: { name: string; translations?: CategoryTranslations | null }, lang: string): string {
  if (lang === "he" || !lang) return cat.name;
  const t = cat.translations as CategoryTranslations | null | undefined;
  return t?.[lang as keyof CategoryTranslations]?.name?.trim() || cat.name;
}
