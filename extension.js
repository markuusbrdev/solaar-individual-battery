import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Cairo from 'gi://cairo';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
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
        this.menu.removeAll();

        let count = 0;
        for (let name in devices) {
            count++;
            const batteryData = devices[name];
            
            const lowerName = name.toLowerCase();
            let deviceIconName = 'input-mouse-symbolic';
            if (lowerName.includes('key') || lowerName.includes('board')) {
                deviceIconName = 'input-keyboard-symbolic';
            }

            const item = new PopupMenu.PopupImageMenuItem(name, deviceIconName);
            item.label.x_expand = true;
            
            const batteryIconName = getBatteryIconNameFn(batteryData.percentage, batteryData.isCharging);
            const batteryIcon = new St.Icon({
                icon_name: batteryIconName,
                style_class: 'popup-menu-icon'
            });

            const batteryText = new St.Label({
                text: `${batteryData.percentage}%`,
                y_align: Clutter.ActorAlign.CENTER,
            });

            const batteryBox = new St.BoxLayout({ 
                vertical: false, 
                style: 'spacing: 4px;' 
            });
            batteryBox.add_child(batteryIcon);
            batteryBox.add_child(batteryText);
            
            item.add_child(batteryBox);
            this.menu.addMenuItem(item);
        }

        if (count === 0) {
            this.set_subtitle('Desconectado');
            const emptyItem = new PopupMenu.PopupMenuItem('Nenhum dispositivo encontrado');
            emptyItem.setSensitive(false);
            this.menu.addMenuItem(emptyItem);
        } else {
            this.set_subtitle(`${count} Dispositivo${count > 1 ? 's' : ''}`);
        }

        // Separador e Botão Abrir Solaar (Estilo nativo de Configurações, garantido de renderizar)
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const openSolaarItem = new PopupMenu.PopupMenuItem('Abrir Solaar');
        openSolaarItem.connect('activate', () => {
            try {
                Gio.Subprocess.new(['solaar'], Gio.SubprocessFlags.NONE);
                Main.overview.hide(); 
                Main.panel.closeCalendar(); 
            } catch (e) {
                console.error(`[Solaar Individual Battery] Erro ao abrir Solaar: ${e.message}`);
            }
        });
        this.menu.addMenuItem(openSolaarItem);
    }
});

// Wrapper SystemIndicator necessário no GNOME 44/45+
const SolaarIndicator = GObject.registerClass(
class SolaarIndicator extends QuickSettings.SystemIndicator {
    _init(extensionPath, settings) {
        super._init();
        this._settings = settings;
        this.toggle = new SolaarToggle(extensionPath);
        this.quickSettingsItems.push(this.toggle);
        this._deviceBoxes = {}; 
        this._tooltips = {}; // Gerenciar tooltips
    }

    _showTooltip(box, name, percentage) {
        if (this._tooltips[name]) {
            this._tooltips[name].destroy();
        }
        
        const tooltip = new St.Label({
            text: `${name}: ${percentage}%`,
            style: 'background-color: rgba(0,0,0,0.8); color: white; border-radius: 4px; padding: 4px 8px; font-size: 13px;'
        });

        Main.layoutManager.addChrome(tooltip);
        
        const [x, y] = box.get_transformed_position();
        const [width, height] = box.get_transformed_size();
        
        tooltip.set_position(Math.floor(x + width / 2 - tooltip.width / 2), Math.floor(y + height + 5));
        this._tooltips[name] = tooltip;
    }

    _hideTooltip(name) {
        if (this._tooltips[name]) {
            Main.layoutManager.removeChrome(this._tooltips[name]);
            this._tooltips[name].destroy();
            delete this._tooltips[name];
        }
    }

    _createCairoIndicator(percentage, isCharging, styleType) {
        const areaWidth = 16;
        const areaHeight = styleType === 'dots' ? 6 : 16;
        
        const area = new St.DrawingArea({
            width: areaWidth,
            height: areaHeight,
            style_class: styleType === 'dots' ? '' : 'system-status-icon',
            style: styleType === 'dots' ? 'margin-top: 1px;' : '',
            x_expand: false,
            x_align: Clutter.ActorAlign.CENTER
        });

        area.connect('repaint', (area) => {
            const cr = area.get_context();
            const [width, height] = area.get_surface_size();
            const cx = width / 2;
            const cy = height / 2;

            let r = 1, g = 1, b = 1;
            if (percentage <= 10) { r = 1; g = 0; b = 0; }
            else if (percentage <= 20) { r = 1; g = 0.5; b = 0; }
            else if (isCharging) { r = 0; g = 1; b = 0; }

            if (styleType === 'circle') {
                cr.setLineWidth(1.5);
                cr.setSourceRGBA(1, 1, 1, 0.2);
                cr.arc(cx, cy, 6, 0, 2 * Math.PI);
                cr.stroke();

                const angle = (percentage / 100) * 2 * Math.PI;
                cr.setSourceRGBA(r, g, b, 1);
                cr.arc(cx, cy, 6, -0.5 * Math.PI, -0.5 * Math.PI + angle);
                cr.stroke();
            } else if (styleType === 'dots') {
                const solidDots = Math.ceil(percentage / 25);
                for (let i = 0; i < 4; i++) {
                    const x = 2 + (i * 4);
                    const y = 3;
                    cr.arc(x, y, 1.5, 0, 2 * Math.PI);
                    if (i < solidDots) {
                        cr.setSourceRGBA(1, 1, 1, 1);
                    } else {
                        cr.setSourceRGBA(1, 1, 1, 0.3);
                    }
                    cr.fill();
                }
            }
            cr.$dispose();
        });

        return area;
    }

    updateTopPanelUI(devices, getBatteryIconNameFn) {
        const indicatorStyle = this._settings.get_string('indicator-style');

        for (let name in this._deviceBoxes) {
            if (!devices[name]) {
                this._hideTooltip(name);
                this._deviceBoxes[name].destroy();
                delete this._deviceBoxes[name];
            }
        }

        for (let name in devices) {
            const batteryData = devices[name];
            
            if (this._deviceBoxes[name]) {
                this._hideTooltip(name);
                this._deviceBoxes[name].destroy();
                delete this._deviceBoxes[name];
            }

            const isDots = indicatorStyle === 'dots';
            
            const box = new St.BoxLayout({
                vertical: isDots,
                x_align: isDots ? Clutter.ActorAlign.CENTER : undefined,
                y_align: Clutter.ActorAlign.CENTER,
                y_expand: true,
                style: 'spacing: 0px; margin-right: 4px;',
                reactive: true // Necessário para tooltips
            });

            // Lógica de Tooltip
            box.connect('enter-event', () => {
                this._showTooltip(box, name, batteryData.percentage);
            });
            box.connect('leave-event', () => {
                this._hideTooltip(name);
            });

            const lowerName = name.toLowerCase();
            let deviceIconName = 'input-mouse-symbolic';
            if (lowerName.includes('key') || lowerName.includes('board')) {
                deviceIconName = 'input-keyboard-symbolic';
            }

            const iconProps = {
                icon_name: deviceIconName,
                style_class: 'system-status-icon',
                style: isDots ? 'icon-size: 14px; margin-top: 2px;' : 'icon-size: 14px; margin-top: 1px; margin-right: 1px;'
            };
            if (isDots) {
                iconProps.x_align = Clutter.ActorAlign.CENTER;
            } else {
                iconProps.y_align = Clutter.ActorAlign.CENTER;
            }
            const deviceIcon = new St.Icon(iconProps);

            box.add_child(deviceIcon);

            if (isDots) {
                const cairoArea = this._createCairoIndicator(batteryData.percentage, batteryData.isCharging, indicatorStyle);
                box.add_child(cairoArea);
            } else if (indicatorStyle === 'circle') {
                const cairoArea = this._createCairoIndicator(batteryData.percentage, batteryData.isCharging, indicatorStyle);
                cairoArea.y_align = Clutter.ActorAlign.CENTER;
                box.add_child(cairoArea);
            } else {
                const batteryIcon = new St.Icon({
                    icon_name: getBatteryIconNameFn(batteryData.percentage, batteryData.isCharging),
                    style_class: 'system-status-icon',
                    style: 'margin-left: 1px;',
                    y_align: Clutter.ActorAlign.CENTER
                });
                box.add_child(batteryIcon);
            }
            
            this._deviceBoxes[name] = box;
            this.add_child(box);
            box.connect('notify::visible', () => this._syncIndicatorsVisible());
        }

        this._syncIndicatorsVisible();
    }
});

export default class SolaarBatteryExtension extends Extension {
    enable() {
        this._settings = this.getSettings('org.gnome.shell.extensions.solaar-individual-battery');
        this._timeoutId = null;

        this._solaarIndicator = new SolaarIndicator(this.dir.get_path(), this._settings);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._solaarIndicator);

        this._updateBatteries();
        
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 120, () => {
            this._updateBatteries();
            return GLib.SOURCE_CONTINUE;
        });

        // Escutar as mudanças nas preferências
        this._settingsSignal = this._settings.connect('changed::indicator-style', () => {
            this._updateBatteries();
        });
    }

    disable() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }

        if (this._settingsSignal) {
            this._settings.disconnect(this._settingsSignal);
            this._settingsSignal = null;
        }

        if (this._solaarIndicator) {
            // Limpar tooltips
            for (let name in this._solaarIndicator._tooltips) {
                this._solaarIndicator._hideTooltip(name);
            }
            this._solaarIndicator.quickSettingsItems.forEach(item => item.destroy());
            this._solaarIndicator.destroy();
            this._solaarIndicator = null;
        }

        this._settings = null;
    }

    async _updateBatteries() {
        try {
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
                    this._solaarIndicator.updateTopPanelUI(devices, this._getBatteryIconName.bind(this));
                    
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
        let iconName = 'battery-';
        if (percentage >= 80) iconName += 'full';
        else if (percentage >= 50) iconName += 'good';
        else if (percentage >= 20) iconName += 'low';
        else if (percentage >= 10) iconName += 'caution';
        else iconName += 'empty';

        if (isCharging) {
            iconName += '-charging';
        }
        iconName += '-symbolic';
        return iconName;
    }
}
