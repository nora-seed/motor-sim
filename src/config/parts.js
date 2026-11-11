/**
 * Parça kataloğu: her kategori için seçenekler ve simülasyon etkileri.
 * Etki alanları (modifier'lar) simulation.js tarafından toplanır.
 */

export const PART_CATEGORIES = [
  {
    id: 'piston',
    name: 'Piston & Segel Seti',
    icon: ' piston',
    options: [
      {
        id: 'stock',
        name: 'Standart Çelik',
        desc: 'Fabrika çıkışı döküm piston, standart segel.',
        modifiers: { power: 1.0, durability: 1.0, vibration: 1.0, heat: 1.0, friction: 1.0 },
        faults: [],
        price: 0,
      },
      {
        id: 'forged',
        name: 'Dövme Alaşım (Performans)',
        desc: 'Hafif dövme alüminyum alaşım. Daha düşük sürtünme, daha yüksek devir güvenliği.',
        modifiers: { power: 1.06, durability: 1.15, vibration: 0.9, heat: 0.92, friction: 0.95 },
        faults: [],
        price: 4200,
      },
      {
        id: 'lightweight',
        name: 'Hafif Yarış Seti',
        desc: 'Ultra hafif yarış pistonsu. Hızlı cevap ama dayanıklılık sınırlı.',
        modifiers: { power: 1.09, durability: 0.8, vibration: 0.85, heat: 0.9, friction: 0.92 },
        faults: [],
        price: 7800,
      },
      {
        id: 'cracked',
        name: 'Çatlak (Hasarlı)',
        desc: 'Kılcal çatlaklar nedeniyle kompresyon kaçırıyor. Ateşleme düzensiz.',
        modifiers: { power: 0.72, durability: 0.3, vibration: 1.4, heat: 1.25, friction: 1.1 },
        faults: ['crackedPiston', 'compressionLeak'],
        price: 0,
      },
    ],
  },
  {
    id: 'crank',
    name: 'Krank Mili & Biyel',
    icon: '⚓',
    options: [
      {
        id: 'stock',
        name: 'Standart Döküm',
        desc: 'Fabrika krankı, denge ağırlıkları yerinde.',
        modifiers: { power: 1.0, durability: 1.0, vibration: 1.0 },
        faults: [],
        price: 0,
      },
      {
        id: 'billet',
        name: 'Billet Çelik (Performans)',
        desc: 'Tam işlenmiş billet krank. Daha yüksek denge toleransı.',
        modifiers: { power: 1.04, durability: 1.2, vibration: 0.82 },
        faults: [],
        price: 6500,
      },
      {
        id: 'unbalanced',
        name: 'Dengesiz (Hasarlı)',
        desc: 'Şaft ağırlıkları dengesiz. Şiddetli titreşim, yatak aşınması.',
        modifiers: { power: 0.9, durability: 0.4, vibration: 2.2, heat: 1.15 },
        faults: ['unbalancedCrank', 'bearingWear'],
        price: 0,
      },
    ],
  },
  {
    id: 'cam',
    name: 'Eksantrik Mili & Supaplar',
    icon: '🔄',
    options: [
      {
        id: 'stock',
        name: 'Standart Zamanlama',
        desc: 'Fabrika kamları, yumuşak rölanti karakteri.',
        modifiers: { power: 1.0, rpmLimit: 1.0, valveTiming: 1.0 },
        faults: [],
        price: 0,
      },
      {
        id: 'sport',
        name: 'Performans Kamları',
        desc: 'Yüksek kaldırım, agresif zamanlama. Güç artar, rölanti sertleşir.',
        modifiers: { power: 1.1, rpmLimit: 1.12, valveTiming: 1.15, vibration: 1.1 },
        faults: [],
        price: 3900,
      },
      {
        id: 'broken',
        name: 'Kopuk Kam (Hasarlı)',
        desc: 'Eksantrik mili koptu; supaplar zamanında açılmıyor.',
        modifiers: { power: 0.35, rpmLimit: 0.5, valveTiming: 0.2 },
        faults: ['brokenCam', 'valveTimingLost'],
        price: 0,
      },
    ],
  },
  {
    id: 'ignition',
    name: 'Buji & Ateşleme',
    icon: '⚡',
    options: [
      {
        id: 'stock',
        name: 'Standart Buji Seti',
        desc: 'Nikel alaşım bujiler, fabrika kıvılcım enerjisi.',
        modifiers: { power: 1.0, ignitionReliability: 1.0, fuel: 1.0 },
        faults: [],
        price: 0,
      },
      {
        id: 'iridium',
        name: 'İridyum Buji',
        desc: 'Daha keskin kıvılcım, daha tutarlı ateşleme, %3 yakıt tasarrufu.',
        modifiers: { power: 1.03, ignitionReliability: 1.15, fuel: 0.97 },
        faults: [],
        price: 900,
      },
      {
        id: 'fouled',
        name: 'Kirli/Yanık Buji (Hasarlı)',
        desc: 'Elektrotlar kurum bağladı. Kıvılcım zayıf, misfire yaşanıyor.',
        modifiers: { power: 0.68, ignitionReliability: 0.35, fuel: 1.2, vibration: 1.35 },
        faults: ['fouledPlugs', 'misfire'],
        price: 0,
      },
    ],
  },
  {
    id: 'induction',
    name: 'Hava & Şarj Sistemi',
    icon: '💨',
    options: [
      {
        id: 'na',
        name: 'Atmosferik Emme',
        desc: 'Standart hava filtresi ve kolektör.',
        modifiers: { power: 1.0, boost: 0, fuel: 1.0 },
        faults: [],
        price: 0,
      },
      {
        id: 'turbo',
        name: 'Turbo Şarj',
        desc: 'Tek turbo, 0.6 bar boost. Düşük devirde gecikme, üstte güçlü tork.',
        modifiers: { power: 1.28, boost: 0.6, fuel: 1.08, heat: 1.2, turboLag: 1 },
        faults: [],
        price: 12500,
      },
      {
        id: 'supercharged',
        name: 'Süper Şarj',
        desc: 'Mekanik kompresör. Anında tepki, biraz güç kaybı.',
        modifiers: { power: 1.18, boost: 0.4, fuel: 1.1, parasiticLoss: 1 },
        faults: [],
        price: 10200,
      },
      {
        id: 'clogged',
        name: 'Tıkalı Emme (Hasarlı)',
        desc: 'Filtre tıkalı, hava akışı kısıtlı. Motor nefes alamıyor.',
        modifiers: { power: 0.62, fuel: 1.25, heat: 1.2 },
        faults: ['cloggedIntake'],
        price: 0,
      },
    ],
  },
  {
    id: 'cooling',
    name: 'Soğutma Sistemi',
    icon: '❄',
    options: [
      {
        id: 'stock',
        name: 'Standart Radyatör',
        desc: 'Fabrika soğutma sistemi, yeterli ama sınırlı.',
        modifiers: { heatDissipation: 1.0, durability: 1.0 },
        faults: [],
        price: 0,
      },
      {
        id: 'performance',
        name: 'Performans Radyatör',
        desc: 'Genişletilmiş alüminyum radyatör + güçlendirilmiş pompa.',
        modifiers: { heatDissipation: 1.4, durability: 1.1, heat: 0.9 },
        faults: [],
        price: 2800,
      },
      {
        id: 'damaged',
        name: 'Hasarlı Radyatör',
        desc: 'Çatlak tank, sızdıran hortum. Motor ısınıyor.',
        modifiers: { heatDissipation: 0.45, heat: 1.5 },
        faults: ['coolingLeak', 'overheat'],
        price: 0,
      },
    ],
  },
];

export const TEST_SCENARIOS = [
  {
    id: 'idle',
    name: 'Rölanti Testi',
    desc: '800 RPM sabit, 10 saniye izle.',
    run: (engine) => engine.setTest({ targetRpm: 800, throttle: 0, duration: 10 }),
  },
  {
    id: 'fullgas',
    name: 'Tam Gaz Çekme',
    desc: 'Rölantiden 6500 RPM\'e kadar tam gaz.',
    run: (engine) => engine.setTest({ targetRpm: 6500, throttle: 100, ramp: true, duration: 8 }),
  },
  {
    id: 'revlimit',
    name: 'Devir Kesici',
    desc: 'Kırmızı çizgiye zorla, kesiciyi izle.',
    run: (engine) => engine.setTest({ targetRpm: 7500, throttle: 100, duration: 6 }),
  },
  {
    id: 'coldstart',
    name: 'Soğuk Çalıştırma',
    desc: 'Soğuktan çalıştırma, ısı grafiğini izle.',
    run: (engine) => engine.setTest({ coldStart: true, targetRpm: 1200, duration: 12 }),
  },
  {
    id: 'misfire',
    name: 'Misfire Testi',
    desc: 'Ateşleme arızası simülasyonu (log + kıvılcım).',
    run: (engine) => engine.injectFault('misfire', 6),
  },
  {
    id: 'overheat',
    name: 'Aşırı Isınma',
    desc: 'Soğutma arızası enjekte et, sıcaklığı izle.',
    run: (engine) => engine.injectFault('overheat', 10),
  },
  {
    id: 'vibration',
    name: 'Dengesizlik Titreşimi',
    desc: 'Krank dengesizliği enjekte et.',
    run: (engine) => engine.injectFault('unbalancedCrank', 8),
  },
];

/** Fault tanımları: aktif olduğunda tetiklenen olaylar */
export const FAULT_DEFS = {
  crackedPiston: {
    name: 'Çatlak Piston',
    severity: 'high',
    visual: 'crack',
    message: 'Piston yüzeyinde çatlak! Kompresyon kaçırıyor, güç düştü.',
  },
  compressionLeak: {
    name: 'Kompresyon Kaçağı',
    severity: 'high',
    visual: 'spark',
    message: 'Silindir basıncı sızıyor – düzensiz ateşleme.',
  },
  unbalancedCrank: {
    name: 'Dengesiz Krank',
    severity: 'high',
    visual: 'shake',
    message: 'Krank dengesiz – şiddetli titreşim, yatak aşınması.',
  },
  bearingWear: {
    name: 'Yatak Aşınması',
    severity: 'medium',
    visual: 'shake',
    message: 'Ana yatak aşınması – metalik gürültü.',
  },
  brokenCam: {
    name: 'Kopuk Eksantrik',
    severity: 'critical',
    visual: 'stop',
    message: 'Eksantrik mili koptu! Supaplar çalışmıyor.',
  },
  valveTimingLost: {
    name: 'Supap Zamanlaması Kaybı',
    severity: 'critical',
    visual: 'timing',
    message: 'Supap zamanlaması tamamen kayboldu.',
  },
  fouledPlugs: {
    name: 'Kirli Buji',
    severity: 'medium',
    visual: 'spark',
    message: 'Buji kurum bağladı – zayıf kıvılcım.',
  },
  misfire: {
    name: 'Misfire',
    severity: 'high',
    visual: 'spark',
    message: 'Silindir ateşleme atlatıyor – düzensiz çalışma.',
  },
  cloggedIntake: {
    name: 'Tıkalı Emme',
    severity: 'medium',
    visual: 'smoke',
    message: 'Hava akışı kısıtlı – motor nefes alamıyor.',
  },
  coolingLeak: {
    name: 'Soğutma Sızıntısı',
    severity: 'medium',
    visual: 'steam',
    message: 'Soğutma suyu sızıyor.',
  },
  overheat: {
    name: 'Aşırı Isınma',
    severity: 'critical',
    visual: 'steam',
    message: 'Motor sıcaklığı kritik seviyede!',
  },
};

export function getFaultDef(id) {
  return FAULT_DEFS[id] || { name: id, severity: 'medium', visual: 'none', message: 'Bilinmeyen arıza.' };
}
