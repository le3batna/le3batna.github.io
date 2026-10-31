// أبيات's circle invite page (/abyat/c/#CODE). The logic is shared with
// رفّ's page: ../../shared/invite.js. This file holds only أبيات's words and
// its App Store link.
import { startInvitePage } from '../../shared/invite.js';

/** The App Store record of أبيات (kAppStoreId in apps/abyat/lib/config.dart). */
export const APP_STORE_URL = 'https://apps.apple.com/app/id6828913971';

export const LABELS = {
  ar: {
    docTitle: 'دعوة إلى حلقة أبيات',
    app: 'أبيات',
    title: 'صاحبك يدعوك لحلقته',
    lead: 'في «الحلقة» ينشر صاحبك قصايده لأصحابه بس. تابعه برمز الدعوة وتوصلك قصايده أول بأول.',
    codeLabel: 'رمز الدعوة',
    copy: 'نسخ الرمز',
    copied: 'تم النسخ!',
    copyFailed: 'ما قدرنا ننسخ، اكتب الرمز بنفسك.',
    steps: ['نزّل أبيات من App Store.', 'افتح تبويب «الحلقة».', 'اضغط «عندك رمز؟» والصق الرمز.'],
    store: 'نزّل أبيات من App Store',
    hint: 'عندك أبيات؟ افتح هذا الرابط من جوالك وينفتح في التطبيق مباشرة.',
    bad: 'ما لقينا رمز دعوة صحيح في هذا الرابط. اطلب من صاحبك يرسله لك مرة ثانية.',
    privacy: 'هذي الصفحة تعرض الرمز على جهازك فقط، وما ترسله لأي مكان.',
  },
  en: {
    docTitle: 'An invite to an Abyat circle',
    app: 'Abyat',
    title: 'A friend invites you to their circle',
    lead: 'In the Circle your friend publishes their poems to their friends only. Follow them with the invite code and their poems come to you.',
    codeLabel: 'Invite code',
    copy: 'Copy code',
    copied: 'Copied!',
    copyFailed: "Couldn't copy it; type the code yourself.",
    steps: ['Get Abyat from the App Store.', 'Open the Circle tab.', 'Tap “Have a code?” and paste the code.'],
    store: 'Get Abyat on the App Store',
    hint: 'Have Abyat? Open this link on your phone and it opens straight in the app.',
    bad: "This link has no valid invite code. Ask your friend to send it again.",
    privacy: 'This page shows the code on your device only and sends it nowhere.',
  },
};

if (typeof document !== 'undefined' && document.getElementById('app')) {
  startInvitePage({ labels: LABELS, appStoreUrl: APP_STORE_URL });
}
