// رفّ's circle invite page (/raff/c/#CODE). The logic is shared with
// أبيات's page: ../../shared/invite.js. This file holds only رفّ's words and
// its App Store link. The steps use the app's own labels: the tab «أصحابي»
// (Friends) and its button, «عندك دعوة؟» (Have an invite?) from 1.1 and «عندك رمز؟»
// (Have a code?) on 1.0: this page names both while 1.0 is still on phones.
import { startInvitePage } from '../../shared/invite.js';

/** The App Store record of رفّ (kAppStoreId in apps/raff/lib/config.dart). */
export const APP_STORE_URL = 'https://apps.apple.com/app/id6828913497';

export const LABELS = {
  ar: {
    docTitle: 'دعوة من صاحبك في رفّ',
    app: 'رفّ',
    title: 'صاحبك يبيك في «أصحابي»',
    lead: 'في «أصحابي» على رفّ يشارك صاحبك ذوقه وتقييماته مع ربعه بس. تابعه بهذي الدعوة وشوف وش يلبس ويلعب ويشوف ويقرأ.',
    codeLabel: 'رمز الدعوة',
    copy: 'نسخ الرمز',
    copied: 'تم النسخ!',
    copyFailed: 'ما قدرنا ننسخ، اكتب الرمز بنفسك.',
    steps: ['نزّل رفّ من App Store.', 'افتح «أصحابي» في التطبيق.', 'اضغط «عندك دعوة؟» (أو «عندك رمز؟») والصق الرمز.'],
    store: 'نزّل رفّ من App Store',
    hint: 'عندك رفّ؟ افتح هذا الرابط من جوالك وينفتح في التطبيق مباشرة.',
    bad: 'ما لقينا دعوة صحيحة في هذا الرابط. اطلب من صاحبك يرسلها لك مرة ثانية.',
    privacy: 'هذي الصفحة تعرض الرمز على جهازك فقط، وما ترسله لأي مكان.',
  },
  en: {
    docTitle: 'An invite from a friend on Raff',
    app: 'Raff',
    title: 'A friend invites you to Friends',
    lead: 'In Friends on Raff, your friend shares their taste and reviews with their friends only. Follow them with this invite and see what they wear, play, watch and read.',
    codeLabel: 'Invite code',
    copy: 'Copy code',
    copied: 'Copied!',
    copyFailed: 'Could not copy it; type the code yourself.',
    steps: ['Get Raff from the App Store.', 'Open Friends in the app.', 'Tap “Have an invite?” (or “Have a code?”) and paste the code.'],
    store: 'Get Raff on the App Store',
    hint: 'Have Raff? Open this link on your phone and it opens straight in the app.',
    bad: 'This link has no valid invite. Ask your friend to send it again.',
    privacy: 'This page shows the code on your device only and sends it nowhere.',
  },
};

if (typeof document !== 'undefined' && document.getElementById('app')) {
  startInvitePage({ labels: LABELS, appStoreUrl: APP_STORE_URL });
}
