# 設計ドキュメント: Demo UI

## 概要

Demo UIは、Cloudflare Worker APIを検証するための単一HTMLファイルのWebアプリケーションです。KV、D1、R2の各ストレージサービスのCRUD操作を視覚的にテストし、APIレスポンスをリアルタイムで確認できるシンプルなインターフェースを提供します。

### 主要な設計目標

- **シンプルさ**: ビルドプロセス不要の単一HTMLファイル
- **直感性**: 学習コストなく使えるUI
- **視覚性**: APIレスポンスの明確な表示
- **保守性**: 読みやすく拡張可能なコード構造

### 技術スタック

- **HTML5**: セマンティックなマークアップ
- **CSS3**: レスポンシブデザイン、Flexbox/Grid
- **Vanilla JavaScript (ES6+)**: フレームワーク不要の実装
- **Fetch API**: HTTPリクエスト処理

## アーキテクチャ

### アーキテクチャパターン

Demo UIは、**モジュラーモノリス**パターンを採用します。単一HTMLファイル内で、機能ごとにモジュール化されたJavaScriptコードを配置し、明確な責任分離を実現します。

```
┌─────────────────────────────────────────────┐
│           Demo UI (Single HTML)             │
├─────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐  │
│  │      UI Layer (DOM Manipulation)     │  │
│  │  - TabManager                        │  │
│  │  - FormRenderer                      │  │
│  │  - ResponseDisplay                   │  │
│  └──────────────────────────────────────┘  │
│                    ↕                        │
│  ┌──────────────────────────────────────┐  │
│  │    Application Layer (Business)      │  │
│  │  - APIClient                         │  │
│  │  - ValidationService                 │  │
│  │  - ErrorHandler                      │  │
│  └──────────────────────────────────────┘  │
│                    ↕                        │
│  ┌──────────────────────────────────────┐  │
│  │   Storage Layer (Persistence)        │  │
│  │  - LocalStorageManager               │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
                     ↕
         ┌───────────────────────┐
         │  Cloudflare Worker    │
         │  API (Backend)        │
         └───────────────────────┘
```

### レイヤー構成

1. **UI Layer**: DOM操作とユーザーインタラクション
2. **Application Layer**: ビジネスロジックとAPI通信
3. **Storage Layer**: ブラウザローカルストレージ管理

## コンポーネントとインターフェース

### 1. TabManager

タブの切り替えとパネル表示を管理します。

```javascript
class TabManager {
  constructor() {
    this.activeTab = 'kv';
  }
  
  switchTab(tabName) {
    // タブの切り替えロジック
    // - 全パネルを非表示
    // - 指定されたパネルを表示
    // - アクティブタブのスタイル更新
  }
  
  init() {
    // タブクリックイベントの設定
  }
}
```

**責任**:
- タブのアクティブ状態管理
- パネルの表示/非表示制御
- タブクリックイベントハンドリング

### 2. APIClient

バックエンドAPIとの通信を担当します。

```javascript
class APIClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }
  
  async request(method, endpoint, body = null, headers = {}) {
    // 汎用HTTPリクエストメソッド
    // - URLの構築
    // - Fetch APIの実行
    // - レスポンスの処理
    // - エラーハンドリング
  }
  
  // KV操作
  async kvStore(key, value) { }
  async kvGet(key) { }
  async kvDelete(key) { }
  async kvList() { }
  
  // D1操作
  async d1CreateUser(name, email) { }
  async d1GetUsers() { }
  async d1GetUser(id) { }
  async d1UpdateUser(id, name, email) { }
  async d1DeleteUser(id) { }
  
  // R2操作
  async r2Upload(key, file) { }
  async r2Download(key) { }
  async r2Delete(key) { }
  async r2List() { }
  
  // ヘルスチェック
  async healthCheck() { }
}
```

**責任**:
- HTTPリクエストの送信
- レスポンスの受信と解析
- エラーレスポンスの処理
- リクエストヘッダーの管理

**エラーハンドリング**:
- ネットワークエラー: `NetworkError`
- HTTPエラー: ステータスコードに基づく分類
- タイムアウト: 30秒でタイムアウト

### 3. ValidationService

ユーザー入力の検証を行います。

```javascript
class ValidationService {
  static validateRequired(value, fieldName) {
    // 必須フィールドの検証
  }
  
  static validateEmail(email) {
    // メールアドレス形式の検証
  }
  
  static validatePositiveInteger(value, fieldName) {
    // 正の整数の検証
  }
  
  static validateFile(file) {
    // ファイルの検証（存在、サイズ）
  }
}
```

**責任**:
- 入力値の検証
- 検証エラーメッセージの生成
- クライアント側バリデーション

**検証ルール**:
- 必須フィールド: 空文字列、null、undefinedを拒否
- メールアドレス: 基本的な形式チェック（`@`を含む）
- 正の整数: 1以上の整数
- ファイル: 存在確認とサイズ制限（最大10MB）

### 4. ResponseDisplay

APIレスポンスを視覚的に表示します。

```javascript
class ResponseDisplay {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }
  
  displayResponse(response, status, headers) {
    // レスポンスの表示
    // - ステータスコードの色分け
    // - JSONのフォーマット
    // - タイムスタンプの表示
  }
  
  displayError(error) {
    // エラーの表示
  }
  
  clear() {
    // 表示のクリア
  }
  
  showLoading() {
    // ローディング表示
  }
  
  hideLoading() {
    // ローディング非表示
  }
}
```

**責任**:
- レスポンスのフォーマット表示
- ステータスコードの色分け
- エラーメッセージの表示
- ローディング状態の管理

**色分けルール**:
- 2xx: 緑（成功）
- 4xx: オレンジ（クライアントエラー）
- 5xx: 赤（サーバーエラー）

### 5. ErrorHandler

エラーの統一的な処理を行います。

```javascript
class ErrorHandler {
  static handle(error, displayComponent) {
    // エラーの種類に応じた処理
    // - NetworkError
    // - ValidationError
    // - HTTPError
  }
  
  static formatErrorMessage(error) {
    // ユーザーフレンドリーなエラーメッセージの生成
  }
}
```

**責任**:
- エラーの分類
- エラーメッセージの整形
- エラーの表示委譲

### 6. LocalStorageManager

ブラウザのローカルストレージを管理します。

```javascript
class LocalStorageManager {
  static save(key, value) {
    // ローカルストレージへの保存
  }
  
  static load(key, defaultValue = null) {
    // ローカルストレージからの読み込み
  }
  
  static remove(key) {
    // ローカルストレージからの削除
  }
}
```

**責任**:
- API Base URLの永続化
- 設定値の保存と読み込み

### 7. FormHandlers

各サービスのフォーム送信を処理します。

```javascript
const KVFormHandlers = {
  async handleStore(apiClient, responseDisplay) { },
  async handleGet(apiClient, responseDisplay) { },
  async handleDelete(apiClient, responseDisplay) { },
  async handleList(apiClient, responseDisplay) { }
};

const D1FormHandlers = {
  async handleCreateUser(apiClient, responseDisplay) { },
  async handleGetUsers(apiClient, responseDisplay) { },
  async handleGetUser(apiClient, responseDisplay) { },
  async handleUpdateUser(apiClient, responseDisplay) { },
  async handleDeleteUser(apiClient, responseDisplay) { }
};

const R2FormHandlers = {
  async handleUpload(apiClient, responseDisplay) { },
  async handleDownload(apiClient, responseDisplay) { },
  async handleDelete(apiClient, responseDisplay) { },
  async handleList(apiClient, responseDisplay) { }
};
```

**責任**:
- フォームデータの取得
- バリデーションの実行
- APIクライアントの呼び出し
- レスポンスの表示

## データモデル

### APIレスポンス構造

```typescript
// 成功レスポンス
interface SuccessResponse {
  success: true;
  data?: any;
  message?: string;
  timestamp: string;
}

// エラーレスポンス
interface ErrorResponse {
  error: string;
  message: string;
  status: number;
  timestamp: string;
}

// ヘルスチェックレスポンス
interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  services: {
    kv: boolean;
    d1: boolean;
    r2: boolean;
  };
  timestamp: string;
}
```

### ローカルストレージデータ

```typescript
interface LocalStorageData {
  apiBaseURL: string;  // デフォルト: 'http://localhost:8787'
}
```

### UIステート

```typescript
interface UIState {
  activeTab: 'kv' | 'd1' | 'r2';
  isLoading: boolean;
  lastResponse: any;
  apiBaseURL: string;
}
```


## Correctness Properties

プロパティとは、システムの全ての有効な実行において真であるべき特性や動作のことです。本質的には、システムが何をすべきかについての形式的な記述です。プロパティは、人間が読める仕様と機械が検証可能な正確性保証の橋渡しとなります。

### Property 1: タブ切り替えでパネル表示

任意のタブ（KV、D1、R2）をクリックしたとき、対応するパネルが表示され、他のパネルは非表示になるべきです。

**Validates: Requirements 1.2**

### Property 2: API Base URLの永続化

任意のURL文字列をAPI Base URL設定に保存したとき、その値はローカルストレージに正しく永続化され、ページ再読み込み後も復元されるべきです。

**Validates: Requirements 1.4, 1.5**

### Property 3: KV操作のリクエスト送信

任意のキーと値に対して、KVパネルの各操作（Store、Get、Delete）を実行したとき、APIClientは正しいHTTPメソッドとエンドポイントにリクエストを送信するべきです。

**Validates: Requirements 2.2, 2.3, 2.4**

### Property 4: D1操作のリクエスト送信

任意のユーザーデータ（ID、名前、メールアドレス）に対して、D1パネルの各操作（Create、Get、Update、Delete）を実行したとき、APIClientは正しいHTTPメソッドとエンドポイントにリクエストを送信するべきです。

**Validates: Requirements 3.2, 3.4, 3.5, 3.6**

### Property 5: R2操作のリクエスト送信

任意のファイルとキーに対して、R2パネルの各操作（Upload、Download、Delete）を実行したとき、APIClientは正しいHTTPメソッドとエンドポイントにリクエストを送信するべきです。

**Validates: Requirements 4.3, 4.4, 4.5**

### Property 6: JSONレスポンスのフォーマット表示

任意のJSONオブジェクトをレスポンスとして受け取ったとき、ResponseDisplayは適切にインデントされた読みやすい形式で表示するべきです。

**Validates: Requirements 2.6, 3.7, 4.8, 5.1**

### Property 7: ステータスコードの色分け

任意のHTTPステータスコードに対して、ResponseDisplayは適切な色（2xx: 緑、4xx: オレンジ、5xx: 赤）を適用して表示するべきです。

**Validates: Requirements 5.2**

### Property 8: レスポンスヘッダーとタイムスタンプの表示

任意のAPIレスポンスに対して、ResponseDisplayはレスポンスヘッダーとタイムスタンプを含めて表示するべきです。

**Validates: Requirements 5.6, 5.7**

### Property 9: エラーレスポンスの表示

任意のエラーレスポンス（4xx、5xx）を受け取ったとき、ErrorHandlerはレスポンスボディからエラー詳細を抽出して表示するべきです。

**Validates: Requirements 6.2**

### Property 10: バリデーションエラーの表示

任意の必須フィールドが空のとき、Demo UIはAPIリクエストを送信する前にバリデーションエラーメッセージを表示するべきです。

**Validates: Requirements 6.3**

### Property 11: エラー後の入力値保持

任意の入力値に対してエラーが発生したとき、Demo UIはユーザーの入力値を保持し、再入力を不要にするべきです。

**Validates: Requirements 6.5**

### Property 12: ローディング状態の管理

任意のAPIリクエストが進行中のとき、Demo UIはローディングインジケーターを表示し、送信ボタンを無効化するべきです。

**Validates: Requirements 7.3, 7.4**

### Property 13: ヘルスチェックステータスの表示

任意のヘルスチェックレスポンスに対して、Demo UIは各サービス（KV、D1、R2）の健全性ステータスを正しく表示するべきです。

**Validates: Requirements 8.3**

### Property 14: ファイルダウンロードのトリガー

任意のファイル名とコンテンツに対して、R2からのダウンロード操作はブラウザのダウンロードを適切なファイル名でトリガーするべきです。

**Validates: Requirements 4.7**

## エラーハンドリング

### エラーの分類

1. **ネットワークエラー**: 接続失敗、タイムアウト
2. **バリデーションエラー**: クライアント側の入力検証失敗
3. **HTTPエラー**: 4xx、5xxステータスコード
4. **パースエラー**: JSONパース失敗

### エラー処理戦略

```javascript
class ErrorHandler {
  static handle(error, displayComponent) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      // ネットワークエラー
      displayComponent.displayError({
        type: 'NetworkError',
        message: 'ネットワークエラーが発生しました。APIサーバーへの接続を確認してください。'
      });
    } else if (error.name === 'ValidationError') {
      // バリデーションエラー
      displayComponent.displayError({
        type: 'ValidationError',
        message: error.message
      });
    } else if (error.status >= 400) {
      // HTTPエラー
      displayComponent.displayError({
        type: 'HTTPError',
        message: error.message || `HTTPエラー: ${error.status}`,
        details: error.body
      });
    } else {
      // その他のエラー
      displayComponent.displayError({
        type: 'UnknownError',
        message: '予期しないエラーが発生しました。'
      });
    }
  }
}
```

### エラー表示の要件

- エラーメッセージは赤色で表示
- エラーの種類を明示
- 技術的な詳細は折りたたみ可能
- ユーザーフレンドリーなメッセージ

### リトライ戦略

- ネットワークエラー: ユーザーに再試行を促す
- 4xxエラー: リトライしない（クライアントエラー）
- 5xxエラー: ユーザーに再試行を促す

## テスト戦略

### デュアルテストアプローチ

Demo UIの正確性を保証するため、ユニットテストとプロパティベーステストの両方を使用します。

- **ユニットテスト**: 特定の例、エッジケース、エラー条件を検証
- **プロパティテスト**: 全ての入力に対する普遍的なプロパティを検証

両者は補完的であり、包括的なカバレッジを実現します。ユニットテストは具体的なバグを捕捉し、プロパティテストは一般的な正確性を検証します。

### プロパティベーステスト

JavaScriptのプロパティベーステストには**fast-check**ライブラリを使用します。

#### 設定

- 各プロパティテストは最低100回の反復を実行
- 各テストは設計ドキュメントのプロパティを参照するコメントを含む
- タグ形式: `// Feature: demo-ui, Property {number}: {property_text}`

#### テスト例

```javascript
import fc from 'fast-check';

// Feature: demo-ui, Property 2: API Base URLの永続化
test('API Base URL persistence round trip', () => {
  fc.assert(
    fc.property(fc.webUrl(), (url) => {
      LocalStorageManager.save('apiBaseURL', url);
      const loaded = LocalStorageManager.load('apiBaseURL');
      expect(loaded).toBe(url);
    }),
    { numRuns: 100 }
  );
});

// Feature: demo-ui, Property 6: JSONレスポンスのフォーマット表示
test('JSON response formatting', () => {
  fc.assert(
    fc.property(fc.object(), (jsonObj) => {
      const formatted = ResponseDisplay.formatJSON(jsonObj);
      const parsed = JSON.parse(formatted);
      expect(parsed).toEqual(jsonObj);
      expect(formatted).toContain('\n'); // インデントを含む
    }),
    { numRuns: 100 }
  );
});

// Feature: demo-ui, Property 7: ステータスコードの色分け
test('Status code color coding', () => {
  fc.assert(
    fc.property(fc.integer({ min: 200, max: 599 }), (status) => {
      const color = ResponseDisplay.getStatusColor(status);
      if (status >= 200 && status < 300) {
        expect(color).toBe('green');
      } else if (status >= 400 && status < 500) {
        expect(color).toBe('orange');
      } else if (status >= 500 && status < 600) {
        expect(color).toBe('red');
      }
    }),
    { numRuns: 100 }
  );
});
```

### ユニットテスト

ユニットテストには**Jest**または**Vitest**を使用します。

#### テスト対象

1. **UI要素の存在確認**
   - タブナビゲーションの存在
   - 各パネルの入力フィールド
   - ボタンの存在

2. **特定の操作**
   - ヘルスチェックボタンのクリック
   - リストボタンのクリック

3. **エッジケース**
   - 空のレスポンス
   - ネットワークエラー
   - 特定のステータスコード（200、404、500）

4. **バリデーション**
   - 空フィールドの検証
   - メールアドレス形式の検証
   - ファイルサイズの検証

#### テスト例

```javascript
// UI要素の存在確認
describe('UI Elements', () => {
  test('should display navigation tabs', () => {
    const tabs = document.querySelectorAll('.tab');
    expect(tabs.length).toBe(3);
    expect(tabs[0].textContent).toBe('KV');
    expect(tabs[1].textContent).toBe('D1');
    expect(tabs[2].textContent).toBe('R2');
  });

  test('should display API base URL input', () => {
    const input = document.getElementById('api-base-url');
    expect(input).toBeTruthy();
    expect(input.placeholder).toBeTruthy();
  });
});

// エッジケース
describe('Error Handling', () => {
  test('should handle network error gracefully', async () => {
    const apiClient = new APIClient('http://invalid-url');
    const responseDisplay = new ResponseDisplay('response-container');
    
    await expect(apiClient.kvGet('test-key')).rejects.toThrow();
  });

  test('should display validation error for empty required field', () => {
    const error = ValidationService.validateRequired('', 'Key');
    expect(error).toBeTruthy();
    expect(error.message).toContain('required');
  });
});

// 特定のステータスコード
describe('Status Code Colors', () => {
  test('should use green for 200 status', () => {
    const color = ResponseDisplay.getStatusColor(200);
    expect(color).toBe('green');
  });

  test('should use orange for 404 status', () => {
    const color = ResponseDisplay.getStatusColor(404);
    expect(color).toBe('orange');
  });

  test('should use red for 500 status', () => {
    const color = ResponseDisplay.getStatusColor(500);
    expect(color).toBe('red');
  });
});
```

### テストカバレッジ目標

- コードカバレッジ: 80%以上
- プロパティテスト: 全ての設計プロパティをカバー
- ユニットテスト: 全てのエッジケースとエラー条件をカバー

### テスト実行環境

- **ブラウザ環境**: JSDOM（Node.js環境でのDOM操作シミュレーション）
- **モック**: Fetch APIのモック（MSWまたはjest.mock）
- **ローカルストレージ**: localStorage-mockまたはJSDOMのlocalStorage

### CI/CD統合

- プルリクエストごとにテスト実行
- テスト失敗時はマージをブロック
- カバレッジレポートの自動生成

