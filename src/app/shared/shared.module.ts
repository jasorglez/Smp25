import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { RouterModule } from '@angular/router';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';


@NgModule({
  imports: [
    CommonModule,
    TranslateModule,
    RouterModule, MatListModule,
    MatIconModule ],
  exports: [
    CommonModule,
    TranslateModule,
    RouterModule, MatListModule,
    MatIconModule ]

})
export class SharedModule { }
