import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../../header/header.component';
import { FooterComponent } from '../../footer/footer.component';
import { ToastContainerComponent } from '../../../shared/components/toast/toast-container.component';
import { DialogHostComponent } from '../../../shared/components/dialog/dialog-host.component';

@Component({
    selector: 'app-marketing-shell',
    standalone: true,
    imports: [
        RouterOutlet,
        HeaderComponent,
        FooterComponent,
        ToastContainerComponent,
        DialogHostComponent,
    ],
    templateUrl: './marketing-shell.component.html',
    styleUrl: './marketing-shell.component.scss'
})
export class MarketingShellComponent {}
