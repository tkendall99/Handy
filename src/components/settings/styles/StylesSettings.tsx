import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  commands,
  type AppCategory,
  type StylesCatalog,
  type StylesSettings as StylesSettingsValue,
  type WritingStyle,
} from "@/bindings";
import {
  Dropdown,
  SettingContainer,
  SettingsGroup,
  ToggleSwitch,
} from "@/components/ui";
import { Button } from "../../ui/Button";
import { PostProcessingSettingsApi } from "../PostProcessingSettingsApi";
import { useSettings } from "../../../hooks/useSettings";
import { useOsType } from "../../../hooks/useOsType";
import { formatKeyCombination } from "../../../lib/utils/keyboard";

const CATEGORIES: AppCategory[] = [
  "personal_messages",
  "work_messages",
  "email",
  "documents",
  "ai_assistants",
  "coding",
  "other",
];

const STYLES: WritingStyle[] = [
  "formal",
  "clean",
  "casual",
  "very_casual",
  "raw",
];

const DEFAULT_STYLES: StylesSettingsValue = {
  enabled: true,
  category_styles: {},
  app_categories: {},
};

export const StylesSettings: React.FC = () => {
  const { t } = useTranslation();
  const osType = useOsType();
  const { getSetting, updateSetting, isUpdating } = useSettings();
  const [catalog, setCatalog] = useState<StylesCatalog | null>(null);

  const styles = getSetting("styles") ?? DEFAULT_STYLES;
  const dictationKey =
    getSetting("bindings")?.transcribe?.current_binding ?? "";

  useEffect(() => {
    commands.getStylesCatalog().then(setCatalog);
  }, []);

  const save = (next: Partial<StylesSettingsValue>) =>
    updateSetting("styles", { ...styles, ...next });

  const styleOptions = useMemo(
    () =>
      STYLES.map((style) => ({
        value: style,
        label: t(`settings.styles.style.${style}.label`),
        description: t(`settings.styles.style.${style}.description`),
      })),
    [t],
  );

  const categoryOptions = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        value: category,
        label: t(`settings.styles.category.${category}`),
      })),
    [t],
  );

  // Built-in apps per category, with the user's overrides applied.
  const appsByCategory = useMemo(() => {
    const names = new Map<string, string>();
    const categoryOf = new Map<string, AppCategory>();
    for (const app of catalog?.known_apps ?? []) {
      names.set(app.bundle_id, app.name);
      categoryOf.set(app.bundle_id, app.category);
    }
    for (const [bundleId, category] of Object.entries(styles.app_categories)) {
      if (category) categoryOf.set(bundleId, category);
    }
    if (catalog?.last_app) {
      names.set(catalog.last_app.bundle_id, catalog.last_app.name);
    }
    // Some apps ship under several IDs (ChatGPT), so list each name once.
    const grouped = new Map<AppCategory, Set<string>>();
    for (const [bundleId, category] of categoryOf) {
      const set = grouped.get(category) ?? new Set<string>();
      set.add(names.get(bundleId) ?? bundleId);
      grouped.set(category, set);
    }
    return grouped;
  }, [catalog, styles.app_categories]);

  const lastApp = catalog?.last_app ?? null;
  const lastAppCategory: AppCategory | null = lastApp
    ? (styles.app_categories[lastApp.bundle_id] ??
      catalog?.last_app_builtin_category ??
      "other")
    : null;
  const lastAppOverridden =
    lastApp !== null && lastApp.bundle_id in styles.app_categories;

  const setLastAppCategory = (category: AppCategory | null) => {
    if (!lastApp) return;
    const app_categories = { ...styles.app_categories };
    if (category === null) {
      delete app_categories[lastApp.bundle_id];
    } else {
      app_categories[lastApp.bundle_id] = category;
    }
    save({ app_categories });
  };

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title={t("settings.styles.title")}>
        <ToggleSwitch
          checked={styles.enabled}
          onChange={(enabled) => save({ enabled })}
          isUpdating={isUpdating("styles")}
          label={t("settings.styles.enabled.label")}
          description={t("settings.styles.enabled.description", {
            dictationKey: formatKeyCombination(dictationKey, osType),
          })}
          descriptionMode="inline"
          grouped={true}
        />
      </SettingsGroup>

      <SettingsGroup
        title={t("settings.styles.categories.title")}
        description={t("settings.styles.categories.description")}
      >
        {CATEGORIES.map((category) => (
          <SettingContainer
            key={category}
            title={t(`settings.styles.category.${category}`)}
            description={
              category === "other"
                ? t("settings.styles.categories.otherApps")
                : [...(appsByCategory.get(category) ?? [])].sort().join(", ")
            }
            descriptionMode="inline"
            layout="horizontal"
            grouped={true}
            disabled={!styles.enabled}
          >
            <Dropdown
              options={styleOptions}
              selectedValue={styles.category_styles[category] ?? "clean"}
              onSelect={(value) =>
                save({
                  category_styles: {
                    ...styles.category_styles,
                    [category]: value as WritingStyle,
                  },
                })
              }
              disabled={!styles.enabled}
            />
          </SettingContainer>
        ))}
      </SettingsGroup>

      {lastApp && lastAppCategory && (
        <SettingsGroup title={t("settings.styles.lastApp.title")}>
          <SettingContainer
            title={lastApp.name || lastApp.bundle_id}
            description={t("settings.styles.lastApp.description")}
            descriptionMode="inline"
            layout="horizontal"
            grouped={true}
          >
            <div className="flex items-center gap-2">
              <Dropdown
                options={categoryOptions}
                selectedValue={lastAppCategory}
                onSelect={(value) => setLastAppCategory(value as AppCategory)}
              />
              {lastAppOverridden && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setLastAppCategory(null)}
                >
                  {t("settings.styles.lastApp.reset")}
                </Button>
              )}
            </div>
          </SettingContainer>
        </SettingsGroup>
      )}

      <SettingsGroup
        title={t("settings.styles.model.title")}
        description={t("settings.styles.model.description")}
      >
        <PostProcessingSettingsApi />
      </SettingsGroup>
    </div>
  );
};
