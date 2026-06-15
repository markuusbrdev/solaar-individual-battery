import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

// Definição do novo botão de Quick Settings (Pílula)
const SolaarToggle = GObject.registerClass(
class SolaarToggle extends QuickSettings.QuickMenuToggle {
    _init(extensionPath) {
        super._init({
            title: 'Logitech',
            toggleMode: true,
        });

        // Ativar o toggle para que ele fique com a cor de destaque (azul/padrão do sistema)
        this.checked = true;

        // Tentar usar o ícone L customizado da Logitech, senão faz fallback para engrenagem
        const iconPath = extensionPath + '/logitech-symbolic.svg';
        const file = Gio.File.new_for_path(iconPath);
        if (file.query_exists(null)) {
            this.gicon = new Gio.FileIcon({ file: file });
            this.menu.setHeader(this.gicon, 'Logitech');
        } else {
            this.iconName = 'preferences-desktop-peripherals-symbolic';
            this.menu.setHeader('preferences-desktop-peripherals-symbolic', 'Logitech');
        }
    }

    updateDevices(devices, getBatteryIconNameFn) {
        // Limpar itens antigos (mantém o cabeçalho no GNOME)
        this.menu.removeAll();

        let count = 0;
        for (let name in devices) {
            count++;
            const batteryData = devices[name];
            
            // Ícone do dispositivo (Teclado/Mouse)
            const lowerName = name.toLowerCase();
            let deviceIconName = 'input-mouse-symbolic';
            if (lowerName.includes('key') || lowerName.includes('board')) {
                deviceIconName = 'input-keyboard-symbolic';
            }

            // Usamos um Item de menu nativo para garantir a renderização correta dentro do Quick Settings
            const item = new PopupMenu.PopupImageMenuItem(name, deviceIconName);
            
            // Texto da Porcentagem da Bateria (Right aligned)
            const batteryText = new St.Label({
                text: `${batteryData.percentage}%`,
                y_align: Clutter.ActorAlign.CENTER,
            });

            // Ícone Dinâmico da Bateria Nativo
            const batteryIconName = getBatteryIconNameFn(batteryData.percentage, batteryData.isCharging);
            const batteryIcon = new St.Icon({
                icon_name: batteryIconName,
                style_class: 'popup-menu-icon'
            });

            const batteryBox = new St.BoxLayout({ vertical: false, style_class: 'popup-menu-icon' });
            batteryBox.add_child(batteryText);
            batteryBox.add_child(batteryIcon);
            
            // Inserir os elementos de bateria no final do MenuItem
            item.insert_child_at_index(batteryBox, item.get_n_children());

            this.menu.addMenuItem(item);
        }

        // Atualizar subtítulo da pílula (ex: "2 Dispositivos")
        if (count === 0) {
            this.set_subtitle('Desconectado');
            const emptyItem = new PopupMenu.PopupMenuItem('Nenhum dispositivo encontrado');
            emptyItem.setSensitive(false);
            this.menu.addMenuItem(emptyItem);
        } else {
            this.set_subtitle(`${count} Dispositivo${count > 1 ? 's' : ''}`);
        }

        // Separador e Botão Abrir Solaar
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const openSolaarItem = new PopupMenu.PopupImageMenuItem('Abrir Solaar', 'preferences-system-symbolic');
        openSolaarItem.connect('activate', () => {
            try {
                Gio.Subprocess.new(['solaar'], Gio.SubprocessFlags.NONE);
                Main.overview.hide(); // Fecha a visão geral (se estiver aberta)
                Main.panel.closeCalendar(); // Recolhe o menu do Quick Settings
            } catch (e) {
                console.error(`[Solaar Individual Battery] Erro ao abrir Solaar: ${e.message}`);
            }
        });
        this.menu.addMenuItem(openSolaarItem);
    }
});

// Wrapper SystemIndicator necessário no GNOME 44/45+ para ancorar a Pílula e seu Submenu corretamente
const SolaarIndicator = GObject.registerClass(
class SolaarIndicator extends QuickSettings.SystemIndicator {
    _init(extensionPath) {
        super._init();
        this.toggle = new SolaarToggle(extensionPath);
        this.quickSettingsItems.push(this.toggle);
        this._deviceBoxes = {}; // Referência para as caixas de ícones na barra superior
    }

    updateTopPanelUI(devices, getBatteryIconNameFn) {
        // 1. Remover indicadores de dispositivos desconectados
        for (let name in this._deviceBoxes) {
            if (!devices[name]) {
                this._deviceBoxes[name].destroy();
                delete this._deviceBoxes[name];
            }
        }

        // 2. Criar ou atualizar indicadores para cada dispositivo
        for (let name in devices) {
            const batteryData = devices[name];
            
            if (!this._deviceBoxes[name]) {
                const box = new St.BoxLayout({
                    vertical: false,
                    style_class: 'panel-status-indicators-box',
                });

                // Ícone do dispositivo (Teclado/Mouse)
                const lowerName = name.toLowerCase();
                let deviceIconName = 'input-mouse-symbolic';
                if (lowerName.includes('key') || lowerName.includes('board')) {
                    deviceIconName = 'input-keyboard-symbolic';
                }

                const deviceIcon = new St.Icon({
                    icon_name: deviceIconName,
                    style_class: 'system-status-icon'
                });

                // Ícone dinâmico da bateria nativo
                const batteryIcon = new St.Icon({
                    icon_name: getBatteryIconNameFn(batteryData.percentage, batteryData.isCharging),
                    style_class: 'system-status-icon',
                });

                box.add_child(deviceIcon);
                box.add_child(batteryIcon);
                
                // Salvar referência para atualizar depois sem recriar
                box._batteryIcon = batteryIcon;
                
                this._deviceBoxes[name] = box;
                
                // Adiciona este conjunto de ícones diretamente ao SystemIndicator (Barra superior unificada)
                this.add_child(box);
                box.connect('notify::visible', () => this._syncIndicatorsVisible());
                
            } else {
                // Atualizar o ícone de bateria existente
                const box = this._deviceBoxes[name];
                box._batteryIcon.set_icon_name(getBatteryIconNameFn(batteryData.percentage, batteryData.isCharging));
            }
        }

        this._syncIndicatorsVisible();
    }
});

export default class SolaarBatteryExtension extends Extension {
    enable() {
        this._timeoutId = null;

        // Instanciar o SystemIndicator que engloba a pílula e os ícones da barra
        this._solaarIndicator = new SolaarIndicator(this.dir.get_path());

        // Injetar no menu de sistema do GNOME de forma moderna através do addExternalIndicator
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._solaarIndicator);

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

        // Remover SystemIndicator (limpa a barra e o Quick Settings automaticamente)
        if (this._solaarIndicator) {
            this._solaarIndicator.quickSettingsItems.forEach(item => item.destroy());
            this._solaarIndicator.destroy();
            this._solaarIndicator = null;
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
                
                if (this._solaarIndicator) {
                    // 1. Atualizar a Barra Superior (dentro do cluster do Quick Settings)
                    this._solaarIndicator.updateTopPanelUI(devices, this._getBatteryIconName.bind(this));
                    
                    // 2. Atualizar a pílula do Quick Settings
                    if (this._solaarIndicator.toggle) {
                        this._solaarIndicator.toggle.updateDevices(devices, this._getBatteryIconName.bind(this));
                    }
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
