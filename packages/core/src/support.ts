/**
 * WHERE A DONATION GOES.
 *
 * One constant, shared by the web app and the native app, so the key can never
 * drift between the two — a donation screen showing a stale key is worse than
 * no donation screen, because it fails silently on the payer's side.
 *
 * ⚠️ It is a RANDOM key (EVP / "chave aleatória"), and that is deliberate: a
 * CPF, phone or e-mail key would put a personal identifier in a public
 * repository. This UUID identifies an account to the payment network and
 * nothing else — it carries no name, no document and no contact.
 *
 * ⚠️ NO NAME IS STORED HERE, and none should be added. The payer's own bank
 * resolves and shows the account holder before confirming, which is where that
 * belongs; the repository does not need to publish it.
 *
 * Why the bare key and not a "Pix Copia e Cola" BR Code: the BR Code carries a
 * merchant name and city, and a payload that any bank silently rejects is a
 * defect that cannot be caught here — there is no way to test it against a real
 * bank from this side. Every Brazilian bank accepts a key pasted into
 * Pix → Transfer → Key, and that path is verifiable end to end.
 */
export const PIX_KEY = "6b58a96e-6387-4074-bbc8-9c2b7386f6b5";
