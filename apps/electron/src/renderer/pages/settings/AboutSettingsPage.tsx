import { useCallback, useState } from 'react'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { routes } from '@/lib/navigate'
import { Spinner } from '@crabpal/ui'
import type { DetailsPageMeta } from '@/lib/navigation-registry'

import {
  SettingsSection,
  SettingsCard,
  SettingsRow,
} from '@/components/settings'
import { useUpdateChecker } from '@/hooks/useUpdateChecker'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'about',
}

const GITHUB_URL = 'https://github.com/boykioyb/crab-pal'

export default function AboutSettingsPage() {
  const updateChecker = useUpdateChecker()
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false)

  const handleCheckForUpdates = useCallback(async () => {
    setIsCheckingForUpdates(true)
    try {
      await updateChecker.checkForUpdates()
    } finally {
      setIsCheckingForUpdates(false)
    }
  }, [updateChecker])

  const handleOpenGithub = useCallback(() => {
    window.electronAPI?.openUrl(GITHUB_URL)
  }, [])

  return (
    <div className="h-full flex flex-col">
      <PanelHeader title="About" actions={<HeaderMenu route={routes.view.settings('about')} helpFeature="app-settings" />} />
      <div className="flex-1 min-h-0 mask-fade-y">
        <ScrollArea className="h-full">
          <div className="px-5 py-7 max-w-3xl mx-auto">
            <div className="space-y-8">
              <SettingsSection title="About">
                <SettingsCard>
                  <SettingsRow label="App">
                    <span className="text-muted-foreground">CrabPal</span>
                  </SettingsRow>
                  <SettingsRow label="Version">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {updateChecker.updateInfo?.currentVersion ?? 'Loading...'}
                      </span>
                      {updateChecker.isDownloading && updateChecker.updateInfo?.latestVersion && (
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <Spinner className="w-3 h-3" />
                          <span>Downloading v{updateChecker.updateInfo.latestVersion} ({updateChecker.downloadProgress}%)</span>
                        </div>
                      )}
                    </div>
                  </SettingsRow>
                  <SettingsRow label="Check for updates">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCheckForUpdates}
                      disabled={isCheckingForUpdates}
                    >
                      {isCheckingForUpdates ? (
                        <>
                          <Spinner className="mr-1.5" />
                          Checking...
                        </>
                      ) : (
                        'Check Now'
                      )}
                    </Button>
                  </SettingsRow>
                  {updateChecker.isReadyToInstall && updateChecker.updateInfo?.latestVersion && (
                    <SettingsRow label="Update ready">
                      <Button
                        size="sm"
                        onClick={updateChecker.installUpdate}
                      >
                        Restart to Update to v{updateChecker.updateInfo.latestVersion}
                      </Button>
                    </SettingsRow>
                  )}
                </SettingsCard>
              </SettingsSection>

              <SettingsSection title="Credits">
                <SettingsCard>
                  <SettingsRow label="Author">
                    <span className="text-muted-foreground">HoaTQ</span>
                  </SettingsRow>
                  <SettingsRow label="GitHub">
                    <button
                      type="button"
                      onClick={handleOpenGithub}
                      className="text-primary hover:underline text-sm"
                    >
                      {GITHUB_URL}
                    </button>
                  </SettingsRow>
                </SettingsCard>
              </SettingsSection>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
