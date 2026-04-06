# Test Environment Documentation

## Overview

このプロジェクトはVitestを使用してテストを実行します。ユニットテストとプロパティベーステストの両方をサポートしています。

## Test Structure

```
src/
├── index.test.ts           # メインアプリケーションのテスト
├── validation.test.ts      # バリデーションとサニタイゼーションのテスト
└── utils/
    ├── testHelpers.ts      # テストヘルパー関数
    ├── mockData.ts         # モックデータ
    └── sanitize.test.ts    # サニタイゼーション関数のテスト
```

## Running Tests

```bash
# 全テストを実行
npm test

# ウォッチモードでテストを実行（開発時）
npm run test:watch

# カバレッジレポートを生成
npm run test:coverage
```

## Test Helpers

`src/utils/testHelpers.ts` には以下のヘルパー関数が含まれています：

- `generateTestKey()` - ユニークなテストキーを生成
- `generateTestEmail()` - ユニークなテストメールアドレスを生成
- `createTestUser()` - テストユーザーデータを作成
- `generateRandomText()` - ランダムなテキストを生成
- `generateRandomBinary()` - ランダムなバイナリデータを生成
- `assertErrorFormat()` - エラーレスポンスの形式を検証
- `assertValidJSON()` - JSONレスポンスを検証
- `assertCORSHeaders()` - CORSヘッダーを検証

## Mock Data

`src/utils/mockData.ts` にはテスト用のサンプルデータが含まれています：

- `mockUsers` - サンプルユーザーデータ
- `mockKVData` - サンプルKVデータ
- `mockR2Files` - サンプルR2ファイルメタデータ

## Configuration

テスト設定は `vitest.config.ts` で管理されています：

- タイムアウト: 30秒
- 環境: Node.js
- カバレッジプロバイダー: v8
- 分離モード: 有効

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { generateTestKey } from './utils/testHelpers';

describe('My Feature', () => {
  it('should work correctly', async () => {
    const key = generateTestKey('feature');
    // テストコード
    expect(result).toBe(expected);
  });
});
```

### Property-Based Test Example

```typescript
import fc from 'fast-check';

it('should preserve data in round trip', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string(),
      async (value) => {
        // プロパティテストコード
      }
    ),
    { numRuns: 100 }
  );
});
```
