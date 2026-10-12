import { TokenCreatorModal } from '../packages/components/asset-manager/token-creator/TokenCreatorModal';
import { Notice, Plugin, TFile } from 'obsidian';
import { AtlasView } from '../atlas-view';
import { DASHBOARD_VIEW_TYPE } from '../dashboard-view';
import { t } from '../i18n';
import type { GlobalAssetManagerService } from '../services/GlobalAssetManagerService';
import type { ImageDisplayService } from '../services/ImageDisplayService';
import { openPlayerWindow, presentActiveTab } from '../services/PlayerWindowPresenter';
import { hasBestiaryFrontmatter } from '../services/statblockNoteSource';
import { TokenStatblockLinkService } from '../services/TokenStatblockLinkService';
import { cleanupMissingAssets } from './cleanupMissingAssets';
import { MythrasCombatService } from '../services/MythrasCombatService';
import {
  createMythrasHumanoidLocationHealth,
} from '../gameSystems/mythras/mythrasHitLocations';

export interface CommandDependencies {
  imageDisplay: ImageDisplayService;
  assetManager: GlobalAssetManagerService;
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp'];

function isImageFile(file: TFile): boolean {
  return IMAGE_EXTENSIONS.includes(file.extension.toLowerCase());
}

async function openDashboard(plugin: Plugin): Promise<void> {
  try {
    const leaf = plugin.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: DASHBOARD_VIEW_TYPE, state: {} });
    plugin.app.workspace.setActiveLeaf(leaf);
  } catch (error) {
    console.error('[Atlas] Error opening dashboard:', error);
    new Notice(t('notice.dashboardOpenFailed'));
  }
}

function registerPlayerViewCommands(plugin: Plugin, imageDisplay: ImageDisplayService): void {
  const { workspace } = plugin.app;

  plugin.addCommand({
    id: 'display-image-on-player-view',
    name: t('command.displayImageOnPlayerView'),
    checkCallback: (checking) => {
      const file = workspace.getActiveFile();
      if (!file || !isImageFile(file)) return false;
      if (!checking) void imageDisplay.displayImageOnPlayerView(file);
      return true;
    },
  });

  plugin.addCommand({
    id: 'dismiss-image-from-player-view',
    name: t('command.dismissImageFromPlayerView'),
    checkCallback: (checking) => {
      if (!imageDisplay.isImageDisplayed()) return false;
      if (!checking) imageDisplay.closeImageDisplay();
      return true;
    },
  });

  plugin.addCommand({
    id: 'send-map-to-player-view',
    name: t('command.sendMapToPlayerView'),
    callback: () => void presentActiveTab(plugin.app),
  });

  plugin.addCommand({
    id: 'show-map-in-player-window',
    name: t('command.showMapInPlayerWindow'),
    callback: () => void presentActiveTab(plugin.app, { openWindow: true }),
  });

  plugin.addCommand({
    id: 'open-player-window',
    name: t('command.openPlayerWindow'),
    callback: () => void openPlayerWindow(plugin.app),
  });

  plugin.addRibbonIcon('monitor', t('command.displayImageOnPlayerView'), () => {
    const file = workspace.getActiveFile();
    if (file && isImageFile(file)) {
      void imageDisplay.displayImageOnPlayerView(file);
    } else {
      new Notice(t('notice.openImageFirst'));
    }
  });
}

function selectedCharacterId(
  view: AtlasView,
): string | null {
  const state = view.getStore().getState();

  if (state.selectedIds.length !== 1) {
    return null;
  }

  const tokenId = state.selectedIds[0];

  if (!tokenId) {
    return null;
  }

  const token =
    state.objects.tokens[tokenId];

  if (!token || token.kind !== 'character') {
    return null;
  }

  return tokenId;
}

function initializeSelectedMythrasCharacter(
  view: AtlasView,
): void {
  const store = view.getStore();
  const tokenId = selectedCharacterId(view);

  if (!tokenId) {
    new Notice(
      'Select exactly one character token.',
    );
    return;
  }

  const state = store.getState();
  const token = state.objects.tokens[tokenId];

  if (!token || token.kind !== 'character') {
    new Notice(
      'The selected token is not a character.',
    );
    return;
  }

  /*
   * Never silently reset an existing health state.
   * This matters once real characters can already
   * be wounded.
   */
  if (token.locationHealth) {
    new Notice(
      `${token.name} already has location health.`,
    );
    return;
  }

  state.updateToken(tokenId, {
    locationHealth:
      createMythrasHumanoidLocationHealth({
        hitPoints: 5,
      }),
  });

  new Notice(
    `Initialized ${token.name} with Mythras humanoid location health.`,
  );
}

function applySelectedMythrasTestWound(
  view: AtlasView,
): void {
  const store = view.getStore();
  const tokenId = selectedCharacterId(view);

  if (!tokenId) {
    new Notice(
      'Select exactly one character token.',
    );
    return;
  }

  const state = store.getState();
  const token = state.objects.tokens[tokenId];

  if (!token || token.kind !== 'character') {
    new Notice(
      'The selected token is not a character.',
    );
    return;
  }

  if (
    !token.locationHealth ||
    token.locationHealth.system !== 'mythras'
  ) {
    new Notice(
      'Initialize this character for Mythras first.',
    );
    return;
  }

  try {
    const service =
      new MythrasCombatService(store);

    const result =
      service.resolveAndApplyHit({
        tokenId,

        locationRoll: 2,
        incomingDamage: 10,

        attackSkill: 70,
        attackRoll: 40,

        enduranceSkill: 60,
        enduranceRoll: 70,

        healingRate: 2,

        majorLimbInjuryType: 'severed',
      });

    const conditions =
      result.applicationPlan
        ?.persistentConditions
        .join(', ') ?? 'none';

    new Notice(
      [
        'Mythras test wound',
        result.resolution.updatedLocation.name,
        `HP ${result.resolution.updatedLocation.hp.current}`,
        result.resolution.status,
        result.applied
          ? 'applied'
          : 'not applied',
        `Conditions: ${conditions}`,
      ].join(' | '),
    );
  } catch (error) {
    console.error(
      '[Mythras Dev] Test wound failed:',
      error,
    );

    new Notice(
      `Mythras test wound failed: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );
  }
}

function inspectSelectedMythrasCharacter(
  view: AtlasView,
): void {
  const store = view.getStore();
  const tokenId = selectedCharacterId(view);

  if (!tokenId) {
    new Notice(
      'Select exactly one character token.',
    );
    return;
  }

  const token =
    store.getState().objects.tokens[tokenId];

  if (!token || token.kind !== 'character') {
    new Notice(
      'The selected token is not a character.',
    );
    return;
  }

  if (!token.locationHealth) {
    new Notice(
      `${token.name} has no location health.`,
    );
    return;
  }

  const summary =
    token.locationHealth.locations
      .map((location) => {
        const flags = [
          location.disabled
            ? 'disabled'
            : null,
          location.severed
            ? 'severed'
            : null,
        ]
          .filter(Boolean)
          .join(', ');

        return [
          location.name,
          `${location.hp.current}/${location.hp.max} HP`,
          flags || 'normal',
        ].join(' | ');
      })
      .join('\n');

  console.log(
    '[Mythras Dev] Character state:',
    token,
  );

  new Notice(
    summary,
    10000,
  );
}
function registerMapCommands(plugin: Plugin, deps: CommandDependencies): void {
  const { app } = plugin;

  plugin.addCommand({
    id: 'open-dashboard',
    name: t('command.openDashboard'),
    callback: () => void openDashboard(plugin),
  });

  plugin.addCommand({
    id: 'open-scene-browser',
    name: t('command.openSceneBrowser'),
    callback: () => deps.assetManager.open('scenes'),
  });

  plugin.addCommand({
    id: 'toggle-initiative-tracker',
    name: t('command.toggleInitiativeTracker'),
    checkCallback: (checking) => {
      const view = app.workspace.getActiveViewOfType(AtlasView);
      if (!view) return false;
      if (!checking) {
        const state = view.getStore().getState();
        state.setInitiativeTrackerOpen(!state.initiativeTrackerOpen);
      }
      return true;
    },
  });

  plugin.addCommand({
    id: 'toggle-loot-roller',
    name: t('command.toggleLootRoller'),
    checkCallback: (checking) => {
      const view = app.workspace.getActiveViewOfType(AtlasView);
      if (!view) return false;
      if (!checking) {
        const state = view.getStore().getState();
        state.setLootRollerOpen(!state.lootRoller.open);
      }
      return true;
    },
  });

  plugin.addCommand({
    id: 'toggle-dice-log',
    name: t('command.toggleDiceLog'),
    checkCallback: (checking) => {
      const view = app.workspace.getActiveViewOfType(AtlasView);
      if (!view) return false;
      if (!checking) {
        const state = view.getStore().getState();
        state.setDiceLogOpen(!state.isDiceLogOpen);
      }
      return true;
    },
  });

  plugin.addCommand({
    id: 'clean-up-missing-assets',
    name: t('command.cleanUpMissingAssets'),
    checkCallback: (checking) => {
      const view = app.workspace.getActiveViewOfType(AtlasView);
      if (!view) return false;
      if (!checking) void cleanupMissingAssets(app, view);
      return true;
    },
  });

  plugin.addCommand({
    id: 'mythras-dev-initialize-selected-character',
    name: 'Mythras Dev: Initialize Selected Character',
    checkCallback: (checking) => {
      const view =
        app.workspace.getActiveViewOfType(
          AtlasView,
        );
      if (!view) {
        return false;
      }
      if (
        selectedCharacterId(view) === null
      ) {
        return false;
      }
      if (!checking) {
        initializeSelectedMythrasCharacter(
          view,
        );
      }
      return true;
    },
});

plugin.addCommand({
  id: 'mythras-dev-apply-test-wound',
  name: 'Mythras Dev: Apply Test Wound',

  checkCallback: (checking) => {
    const view =
      app.workspace.getActiveViewOfType(
        AtlasView,
      );

    if (!view) {
      return false;
    }

    if (
      selectedCharacterId(view) === null
    ) {
      return false;
    }

    if (!checking) {
      applySelectedMythrasTestWound(
        view,
      );
    }

    return true;
  },
});

 plugin.addCommand({
  id: 'mythras-dev-inspect-selected-character',
  name: 'Mythras Dev: Inspect Selected Character',

  checkCallback: (checking) => {
    const view =
      app.workspace.getActiveViewOfType(
        AtlasView,
      );

    if (!view) {
      return false;
    }

    if (
      selectedCharacterId(view) === null
    ) {
      return false;
    }

    if (!checking) {
      inspectSelectedMythrasCharacter(
        view,
      );
    }

    return true;
  },
});
}

function registerStatblockCommands(plugin: Plugin): void {
  const { app } = plugin;

  plugin.addCommand({
    id: 'import-statblock-tokens',
    name: t('command.importStatblockTokens'),
    callback: () => new TokenCreatorModal(app).open(),
  });

  plugin.addCommand({
    id: 'create-token-from-statblock',
    name: t('command.createTokenFromStatblock'),
    checkCallback: (checking) => {
      const file = app.workspace.getActiveFile();
      if (!file || !hasBestiaryFrontmatter(app, file)) return false;
      if (!checking) {
        void TokenStatblockLinkService.getInstance(app).createTokenFromStatblockImage(file.path);
      }
      return true;
    },
  });
}

export function registerCommands(plugin: Plugin, deps: CommandDependencies): void {
  registerPlayerViewCommands(plugin, deps.imageDisplay);
  registerMapCommands(plugin, deps);
  registerStatblockCommands(plugin);
}
