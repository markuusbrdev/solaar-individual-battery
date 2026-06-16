import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class SolaarPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const page = new Adw.PreferencesPage();
        
        const group = new Adw.PreferencesGroup({
            title: 'Aparência',
            description: 'Configurações visuais da extensão Solaar Individual Battery.'
        });
        page.add(group);

        const row = new Adw.ComboRow({
            title: 'Estilo do Indicador',
            subtitle: 'Escolha como a bateria dos dispositivos será renderizada na barra superior.',
            model: Gtk.StringList.new(['Padrão (Ícone Nativo)', 'Pontilhados', 'Círculo'])
        });

        const settings = this.getSettings('org.gnome.shell.extensions.solaar-individual-battery');

        // Mapear o valor atual do GSettings para o dropdown
        const currentStyle = settings.get_string('indicator-style');
        if (currentStyle === 'dots') {
            row.selected = 1;
        } else if (currentStyle === 'circle') {
            row.selected = 2;
        } else {
            row.selected = 0;
        }

        // Mapear a alteração do dropdown para o GSettings
        row.connect('notify::selected', () => {
            let val = 'standard';
            if (row.selected === 1) val = 'dots';
            else if (row.selected === 2) val = 'circle';
            settings.set_string('indicator-style', val);
        });

        group.add(row);
        
        // Adicionar uma dica visual de como carregar os perfis
        const tipRow = new Adw.ActionRow({
            title: 'Estilos Customizados (Pontilhados / Círculo)',
            subtitle: 'As baterias serão desenhadas à mão (Geometria 2D) com a API Cairo do GNOME.'
        });
        group.add(tipRow);

        window.add(page);
    }
}
