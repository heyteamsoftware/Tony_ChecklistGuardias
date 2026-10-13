<?php
// Copia este fichero a /var/lib/tony-guardias/config.php (fuera de la web) y rellénalo.
return [
    // URL /exec de la aplicación web de Google Apps Script (apps-script/Codigo.gs).
    // Mientras esté vacía, las rondas se guardan en el servidor y se envían en cuanto se rellene.
    'apps_script_url'   => '',

    // Debe coincidir con TOKEN en Codigo.gs.
    'apps_script_token' => '',
];
