/**
 * 日用品博物館（R12）の展示品の品目表（生成側と描画側で共有。形は src/render/props/MuseumObjects.ts）。
 * 寸法は実物大の外寸 [幅, 高さ, 奥行き]。説明文は壁沿いのケースの上に掲げる英語の展示ラベル
 */
export const EXHIBIT_KINDS = ['kettle', 'phone', 'radio', 'bucket', 'chair', 'fan', 'riceCooker', 'iron', 'lamp', 'clock', 'thermos'] as const;
export type ExhibitKind = typeof EXHIBIT_KINDS[number];

export function isExhibitKind(v: string): v is ExhibitKind {
  return (EXHIBIT_KINDS as readonly string[]).includes(v);
}

/** 外寸 [幅, 高さ, 奥行き]（ケースに入るかの判定と、焼き込みの標本位置） */
export const EXHIBIT_SIZE: Record<ExhibitKind, [number, number, number]> = {
  kettle: [0.2, 0.24, 0.26], phone: [0.22, 0.16, 0.24], radio: [0.3, 0.46, 0.08], bucket: [0.34, 0.3, 0.34], chair: [0.46, 0.82, 0.52],
  fan: [0.32, 0.47, 0.3], riceCooker: [0.29, 0.28, 0.3], iron: [0.13, 0.15, 0.4], lamp: [0.18, 0.42, 0.3], clock: [0.16, 0.21, 0.06], thermos: [0.2, 0.34, 0.28],
};

/** 壁の説明文（英語の展示ラベル） */
export const EXHIBIT_CAPTIONS: Record<ExhibitKind, string> = {
  kettle: 'KETTLE, ELECTRIC, c. 1998', phone: 'TELEPHONE, ROTARY, 1974', radio: 'RADIO, TRANSISTOR, 1966', bucket: 'BUCKET, 10 L',
  chair: 'CHAIR, MOULDED PLASTIC', fan: 'FAN, ELECTRIC, 1983', riceCooker: 'RICE COOKER, 1979', iron: 'IRON, STEAM',
  lamp: 'DESK LAMP', clock: 'ALARM CLOCK, TWIN BELL', thermos: 'VACUUM FLASK, PUMP',
};
