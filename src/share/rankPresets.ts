/**
 * ランク（スコア称号）ごとの見た目・コメントのプリセット。
 * 結果画面の一言診断とResult Card画像の両方から参照される、単一の情報源。
 */
export interface RankPreset {
  /** キャラクター画像のファイル名（拡張子なし） */
  key: string;
  /** public/characters/ 以下のパス */
  characterImage: string;
  /** 結果画面・Result Cardで表示する一言診断（改行は\nで区切る） */
  comment: string;
  /** Result Cardの背景演出の強さ（0=火なし煙のみ 〜 5=最大級の炎） */
  fireLevel: 0 | 1 | 2 | 3 | 4 | 5;
}

export const RANK_PRESETS: Record<string, RankPreset> = {
  都会に帰ろう: {
    key: 'civilization-survivor',
    characterImage: '/characters/civilization-survivor.webp',
    comment: '無人島はあなたに向いていないかもしれない。\n次はマッチを持ってこよう。',
    fireLevel: 0,
  },
  キャンプ初心者: {
    key: 'rookie-survivor',
    characterImage: '/characters/rookie-survivor.webp',
    comment: '小さな火種はつかんだ。\n次はもっとうまくやれるはずだ。',
    fireLevel: 1,
  },
  サバイバー: {
    key: 'campfire-survivor',
    characterImage: '/characters/campfire-survivor.webp',
    comment: '火は起こせる。\n生き残る準備はできてきた。',
    fireLevel: 2,
  },
  ワイルドサバイバー: {
    key: 'wild-survivor',
    characterImage: '/characters/wild-survivor.webp',
    comment: 'あなたは悪条件の中でも火を起こした。\n今夜は生き延びられそうだ。',
    fireLevel: 3,
  },
  サバイバルマスター: {
    key: 'survival-master',
    characterImage: '/characters/survival-master.webp',
    comment: '見事な火おこし。\n島の動物たちもあなたを一目置いている。',
    fireLevel: 4,
  },
  人類代表: {
    key: 'humanity-champion',
    characterImage: '/characters/humanity-champion.webp',
    comment: 'プロメテウスもきっと驚く手際。\n人類の火の歴史に、あなたの名が刻まれた。',
    fireLevel: 5,
  },
};

export function getRankPreset(rank: string): RankPreset {
  return RANK_PRESETS[rank] ?? RANK_PRESETS['サバイバー'];
}
