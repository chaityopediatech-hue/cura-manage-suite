import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Lang = "en" | "es" | "fr" | "ar" | "bn";

const dict: Record<Lang, Record<string, string>> = {
  en: {
    appName: "MediCore",
    tagline: "Modern clinic management, made simple.",
    signIn: "Sign in", signUp: "Sign up", signOut: "Sign out",
    email: "Email", password: "Password", fullName: "Full name", phone: "Phone",
    dashboard: "Dashboard", doctors: "Doctors", patients: "Patients",
    appointments: "Appointments", prescriptions: "Prescriptions", assistant: "AI Assistant",
    home: "Home", language: "Language", search: "Search",
    add: "Add", edit: "Edit", delete: "Delete", save: "Save", cancel: "Cancel",
    book: "Book appointment", noData: "No records yet.", loading: "Loading…",
    role: "Role", admin: "Admin", doctor: "Doctor", patient: "Patient",
    todayAppts: "Today's appointments", pendingAppts: "Pending", totalDoctors: "Total doctors", totalPatients: "Total patients",
    quickActions: "Quick actions", recentActivity: "Recent activity",
    name: "Name", specialty: "Specialty", department: "Department", availability: "Availability", status: "Status",
    age: "Age", gender: "Gender", address: "Address", bloodGroup: "Blood group", medicalHistory: "Medical history",
    date: "Date", time: "Time", reason: "Reason", diagnosis: "Diagnosis", instructions: "Instructions",
    medicine: "Medicine", dosage: "Dosage", timing: "Timing", duration: "Duration",
    symptoms: "Symptoms", priority: "Priority", emergency: "Emergency", high: "High", medium: "Medium", low: "Low",
    autoAssign: "Auto-assign best doctor", emergencyAlerts: "Emergency cases",
    suggestedSpecialty: "Suggested specialty", triageNotice: "Triage analysis",
    aiDisclaimer: "This AI assistant is for clinic support only and not a replacement for professional medical advice.",
    aiPlaceholder: "Ask a clinical question…",
    features: "Features", featureAnalytics: "Clinic analytics dashboard", featureRx: "Digital prescriptions",
    featureAccess: "Secure access control", featureAI: "AI Assistant",
    getStarted: "Get started", learnMore: "Learn more",
    reports: "Reports", upload: "Upload", download: "Download", departments: "Departments",
    diagnoses: "Diagnoses", timeline: "Timeline", riskScore: "Risk score", followUp: "Follow-up",
    theme: "Theme", lightMode: "Light", darkMode: "Dark",
  },
  es: {
    appName: "MediCore", tagline: "Gestión de clínica moderna, simple.",
    signIn: "Iniciar sesión", signUp: "Registrarse", signOut: "Cerrar sesión",
    email: "Correo", password: "Contraseña", fullName: "Nombre completo", phone: "Teléfono",
    dashboard: "Panel", doctors: "Doctores", patients: "Pacientes",
    appointments: "Citas", prescriptions: "Recetas", assistant: "Asistente IA",
    home: "Inicio", language: "Idioma", search: "Buscar",
    add: "Añadir", edit: "Editar", delete: "Eliminar", save: "Guardar", cancel: "Cancelar",
    book: "Reservar cita", noData: "Sin registros aún.", loading: "Cargando…",
    role: "Rol", admin: "Admin", doctor: "Doctor", patient: "Paciente",
    todayAppts: "Citas de hoy", pendingAppts: "Pendientes", totalDoctors: "Total doctores", totalPatients: "Total pacientes",
    quickActions: "Acciones rápidas", recentActivity: "Actividad reciente",
    name: "Nombre", specialty: "Especialidad", department: "Departamento", availability: "Disponibilidad", status: "Estado",
    age: "Edad", gender: "Género", address: "Dirección", bloodGroup: "Grupo sanguíneo", medicalHistory: "Historial médico",
    date: "Fecha", time: "Hora", reason: "Motivo", diagnosis: "Diagnóstico", instructions: "Instrucciones",
    medicine: "Medicamento", dosage: "Dosis", timing: "Horario", duration: "Duración",
    aiDisclaimer: "Este asistente de IA es solo para apoyo clínico y no reemplaza el consejo médico profesional.",
    aiPlaceholder: "Haz una pregunta clínica…",
    features: "Funciones", featureAnalytics: "Panel de análisis clínico", featureRx: "Recetas digitales",
    featureAccess: "Control de acceso seguro", featureAI: "Asistente IA",
    getStarted: "Comenzar", learnMore: "Saber más",
  },
  fr: {
    appName: "MediCore", tagline: "Gestion de clinique moderne, simplifiée.",
    signIn: "Connexion", signUp: "Inscription", signOut: "Déconnexion",
    email: "E-mail", password: "Mot de passe", fullName: "Nom complet", phone: "Téléphone",
    dashboard: "Tableau de bord", doctors: "Médecins", patients: "Patients",
    appointments: "Rendez-vous", prescriptions: "Ordonnances", assistant: "Assistant IA",
    home: "Accueil", language: "Langue", search: "Rechercher",
    add: "Ajouter", edit: "Modifier", delete: "Supprimer", save: "Enregistrer", cancel: "Annuler",
    book: "Prendre RDV", noData: "Aucun enregistrement.", loading: "Chargement…",
    role: "Rôle", admin: "Admin", doctor: "Médecin", patient: "Patient",
    todayAppts: "RDV du jour", pendingAppts: "En attente", totalDoctors: "Total médecins", totalPatients: "Total patients",
    quickActions: "Actions rapides", recentActivity: "Activité récente",
    name: "Nom", specialty: "Spécialité", department: "Service", availability: "Disponibilité", status: "Statut",
    age: "Âge", gender: "Sexe", address: "Adresse", bloodGroup: "Groupe sanguin", medicalHistory: "Antécédents",
    date: "Date", time: "Heure", reason: "Motif", diagnosis: "Diagnostic", instructions: "Instructions",
    medicine: "Médicament", dosage: "Dosage", timing: "Moment", duration: "Durée",
    aiDisclaimer: "Cet assistant IA est uniquement un support clinique et ne remplace pas un avis médical professionnel.",
    aiPlaceholder: "Posez une question clinique…",
    features: "Fonctionnalités", featureAnalytics: "Tableau de bord analytique", featureRx: "Ordonnances numériques",
    featureAccess: "Contrôle d'accès sécurisé", featureAI: "Assistant IA",
    getStarted: "Commencer", learnMore: "En savoir plus",
  },
  ar: {
    appName: "MediCore", tagline: "إدارة عيادة حديثة وبسيطة.",
    signIn: "تسجيل الدخول", signUp: "إنشاء حساب", signOut: "تسجيل الخروج",
    email: "البريد", password: "كلمة المرور", fullName: "الاسم الكامل", phone: "الهاتف",
    dashboard: "لوحة التحكم", doctors: "الأطباء", patients: "المرضى",
    appointments: "المواعيد", prescriptions: "الوصفات", assistant: "المساعد الذكي",
    home: "الرئيسية", language: "اللغة", search: "بحث",
    add: "إضافة", edit: "تعديل", delete: "حذف", save: "حفظ", cancel: "إلغاء",
    book: "حجز موعد", noData: "لا توجد سجلات.", loading: "جارٍ التحميل…",
    role: "الدور", admin: "مدير", doctor: "طبيب", patient: "مريض",
    todayAppts: "مواعيد اليوم", pendingAppts: "قيد الانتظار", totalDoctors: "إجمالي الأطباء", totalPatients: "إجمالي المرضى",
    quickActions: "إجراءات سريعة", recentActivity: "النشاط الأخير",
    name: "الاسم", specialty: "التخصص", department: "القسم", availability: "التوفر", status: "الحالة",
    age: "العمر", gender: "الجنس", address: "العنوان", bloodGroup: "فصيلة الدم", medicalHistory: "السجل الطبي",
    date: "التاريخ", time: "الوقت", reason: "السبب", diagnosis: "التشخيص", instructions: "التعليمات",
    medicine: "الدواء", dosage: "الجرعة", timing: "التوقيت", duration: "المدة",
    aiDisclaimer: "هذا المساعد الذكي للدعم العياديّ فقط ولا يغني عن استشارة طبية متخصصة.",
    aiPlaceholder: "اطرح سؤالًا سريريًا…",
    features: "الميزات", featureAnalytics: "لوحة تحليلات العيادة", featureRx: "وصفات رقمية",
    featureAccess: "تحكم وصول آمن", featureAI: "المساعد الذكي",
    getStarted: "ابدأ الآن", learnMore: "اعرف المزيد",
  },
  bn: {
    appName: "MediCore", tagline: "আধুনিক ক্লিনিক ব্যবস্থাপনা, সহজভাবে।",
    signIn: "সাইন ইন", signUp: "নিবন্ধন", signOut: "সাইন আউট",
    email: "ইমেইল", password: "পাসওয়ার্ড", fullName: "পূর্ণ নাম", phone: "ফোন",
    dashboard: "ড্যাশবোর্ড", doctors: "ডাক্তার", patients: "রোগী",
    appointments: "অ্যাপয়েন্টমেন্ট", prescriptions: "প্রেসক্রিপশন", assistant: "এআই সহকারী",
    home: "হোম", language: "ভাষা", search: "অনুসন্ধান",
    add: "যোগ করুন", edit: "সম্পাদনা", delete: "মুছুন", save: "সংরক্ষণ", cancel: "বাতিল",
    book: "অ্যাপয়েন্টমেন্ট বুক করুন", noData: "কোনো তথ্য নেই।", loading: "লোড হচ্ছে…",
    role: "ভূমিকা", admin: "অ্যাডমিন", doctor: "ডাক্তার", patient: "রোগী",
    todayAppts: "আজকের অ্যাপয়েন্টমেন্ট", pendingAppts: "মুলতুবি", totalDoctors: "মোট ডাক্তার", totalPatients: "মোট রোগী",
    quickActions: "দ্রুত কার্যক্রম", recentActivity: "সাম্প্রতিক কার্যকলাপ",
    name: "নাম", specialty: "বিশেষজ্ঞতা", department: "বিভাগ", availability: "উপলব্ধতা", status: "অবস্থা",
    age: "বয়স", gender: "লিঙ্গ", address: "ঠিকানা", bloodGroup: "রক্তের গ্রুপ", medicalHistory: "চিকিৎসা ইতিহাস",
    date: "তারিখ", time: "সময়", reason: "কারণ", diagnosis: "রোগ নির্ণয়", instructions: "নির্দেশনা",
    medicine: "ওষুধ", dosage: "ডোজ", timing: "সময়সূচি", duration: "মেয়াদ",
    symptoms: "উপসর্গ", priority: "অগ্রাধিকার", emergency: "জরুরি", high: "উচ্চ", medium: "মাঝারি", low: "নিম্ন",
    autoAssign: "স্বয়ংক্রিয় ডাক্তার বরাদ্দ", emergencyAlerts: "জরুরি ক্ষেত্র",
    suggestedSpecialty: "প্রস্তাবিত বিশেষজ্ঞতা", triageNotice: "ট্রায়াজ বিশ্লেষণ",
    aiDisclaimer: "এই এআই সহকারী শুধুমাত্র ক্লিনিক সহায়তার জন্য, পেশাদার চিকিৎসা পরামর্শের বিকল্প নয়।",
    aiPlaceholder: "একটি ক্লিনিকাল প্রশ্ন জিজ্ঞাসা করুন…",
    features: "বৈশিষ্ট্য", featureAnalytics: "ক্লিনিক বিশ্লেষণ ড্যাশবোর্ড", featureRx: "ডিজিটাল প্রেসক্রিপশন",
    featureAccess: "নিরাপদ অ্যাক্সেস নিয়ন্ত্রণ", featureAI: "এআই সহকারী",
    getStarted: "শুরু করুন", learnMore: "আরও জানুন",
  },
};

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string }>({
  lang: "en", setLang: () => {}, t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem("medicore_lang")) as Lang | null;
    if (saved && dict[saved]) { setLangState(saved); return; }
    const browser = typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "en";
    if ((dict as Record<string, unknown>)[browser]) setLangState(browser as Lang);
  }, []);
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    }
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof localStorage !== "undefined") localStorage.setItem("medicore_lang", l);
  };
  const t = (k: string) => dict[lang][k] ?? dict.en[k] ?? k;
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" }, { code: "es", label: "Español" },
  { code: "fr", label: "Français" }, { code: "ar", label: "العربية" },
  { code: "bn", label: "বাংলা" },
];
