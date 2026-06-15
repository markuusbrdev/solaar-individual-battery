import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

// Definição do novo botão de Quick Settings (Pílula)
const SolaarToggle = GObject.registerClass(
class SolaarToggle extends QuickSettings.QuickMenuToggle {
    _init() {
        super._init({
            title: 'Logitech',
            iconName: 'preferences-desktop-peripherals-symbolic',
            toggleMode: false,
        });

        // Configura o cabeçalho do menu dropdown
        this.menu.setHeader('preferences-desktop-peripherals-symbolic', 'Dispositivos Logitech');
    }

    updateDevices(devices, getBatteryIconNameFn) {
        // Limpar o menu atual para evitar duplicação a cada polling
        this.menu.removeAll();
        
        let count = 0;
        for (let name in devices) {
            count++;
            const batteryData = devices[name];
            
            // Criamos um item base para ter liberdade total no layout
            const item = new PopupMenu.PopupBaseMenuItem();

            // 1. Ícone do dispositivo (Mouse/Teclado)
            const lowerName = name.toLowerCase();
            let deviceIconName = 'input-mouse-symbolic';
            if (lowerName.includes('key') || lowerName.includes('board')) {
                deviceIconName = 'input-keyboard-symbolic';
            }

            const deviceIcon = new St.Icon({
                icon_name: deviceIconName,
                style_class: 'popup-menu-icon'
            });

            // 2. Label com o nome do dispositivo (expande para empurrar a bateria para a direita)
            const label = new St.Label({
                text: name,
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
                style: 'margin-left: 12px;'
            });

            // 3. Texto da Porcentagem da Bateria
            const batteryText = new St.Label({
                text: `${batteryData.percentage}%`,
                y_align: Clutter.ActorAlign.CENTER,
                style: 'margin-right: 8px;'
            });

            // 4. Ícone Dinâmico da Bateria Nativo
            const batteryIconName = getBatteryIconNameFn(batteryData.percentage, batteryData.isCharging);
            const batteryIcon = new St.Icon({
                icon_name: batteryIconName,
                style_class: 'popup-menu-icon'
            });

            // Adicionar os componentes ao Item na ordem correta
            item.add_child(deviceIcon);
            item.add_child(label);
            item.add_child(batteryText);
            item.add_child(batteryIcon);

            // Ação ao clicar no dispositivo do submenu: Abrir Solaar
            item.connect('activate', () => {
                try {
                    Gio.Subprocess.new(['solaar'], Gio.SubprocessFlags.NONE);
                    Main.overview.hide(); // Fecha a visão geral (se estiver aberta)
                    Main.panel.closeCalendar(); // Recolhe o menu do Quick Settings
                } catch (e) {
                    console.error(`[Solaar Quick Settings] Erro ao abrir Solaar: ${e.message}`);
                }
            });

            this.menu.addMenuItem(item);
        }

        // Atualizar subtítulo da pílula (ex: "2 Dispositivos")
        if (count === 0) {
            this.subtitle = 'Desconectado';
            const emptyItem = new PopupMenu.PopupMenuItem('Nenhum dispositivo encontrado');
            emptyItem.setSensitive(false);
            this.menu.addMenuItem(emptyItem);
        } else {
            this.subtitle = `${count} Dispositivo${count > 1 ? 's' : ''}`;
        }
    }
});

export default class SolaarBatteryExtension extends Extension {
    enable() {
        this._timeoutId = null;

        // Instanciar o botão (Pílula) do Quick Settings
        this._solaarToggle = new SolaarToggle();

        // Injetar no menu de sistema do GNOME de forma moderna
        Main.panel.statusArea.quickSettings.menu.addItem(this._solaarToggle);

        // Primeira chamada manual para exibir imediatamente ao habilitar
        this._updateBatteries();
        
        // Loop a cada 120 segundos (2 minutos)
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 120, () => {
            this._updateBatteries();
            return GLib.SOURCE_CONTINUE;
        });
    }

    disable() {
        // Remover timeout do GLib
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }

        // Remover do painel do GNOME para evitar memory leaks/duplicação
        if (this._solaarToggle) {
            this._solaarToggle.destroy();
            this._solaarToggle = null;
        }
    }

    async _updateBatteries() {
        try {
            // Subprocesso assíncrono mantido puro
            const proc = Gio.Subprocess.new(
                ['solaar', 'show'],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );

            const [, stdout] = await new Promise((resolve, reject) => {
                proc.communicate_utf8_async(null, null, (p, res) => {
                    try {
                        resolve(p.communicate_utf8_finish(res));
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            if (stdout) {
                const devices = this._parseSolaarOutput(stdout);
                
                // Enviar os dados do polling para o Quick Toggle processar
                if (this._solaarToggle) {
                    this._solaarToggle.updateDevices(devices, this._getBatteryIconName.bind(this));
                }
            }
        } catch (error) {
            console.error(`[Solaar Individual Battery] Erro ao executar solaar show: ${error.message}`);
        }
    }

    _parseSolaarOutput(stdout) {
        let currentDevice = null;
        let devices = {};
        const lines = stdout.split('\n');
        
        for (let line of lines) {
            let devMatch = line.match(/^  \d+:\s+(.+)$/);
            if (devMatch) {
                currentDevice = devMatch[1].trim();
            } 
            else if (currentDevice && line.includes('Battery:')) {
                let match = line.match(/Battery:\s*(\d+)%/);
                if (match) {
                    let lowerLine = line.toLowerCase();
                    // Considera carregando se houver "charging" ou "recharging" e não "discharging"
                    let isCharging = !lowerLine.includes('discharging') && lowerLine.includes('charging');
                    
                    devices[currentDevice] = {
                        percentage: parseInt(match[1], 10),
                        isCharging: isCharging
                    };
                    currentDevice = null;
                }
            }
        }
        return devices;
    }

    _getBatteryIconName(percentage, isCharging) {
        let rounded = Math.round(percentage / 10) * 10;
        rounded = Math.max(0, Math.min(100, rounded)); // Segurança
        
        let iconName = `battery-level-${rounded}`;
        if (isCharging) {
            iconName += '-charging';
        }
        iconName += '-symbolic';
        return iconName;
    }
}
