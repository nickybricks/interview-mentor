# Lessons Learned

<!-- Patterns and corrections log. Updated after any correction from the user. -->

## i18n: both locales must be updated together

The `TranslationKey` type is derived from `typeof translations.de` and used as an index into both `de` and `en` sub-objects. Adding a key only to `de` causes a TS7053 error at the `t()` call site because the union type of both locale objects no longer includes the new key. Always add new keys to `de` and `en` in the same edit.
