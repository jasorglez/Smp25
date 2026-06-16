import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimeEditorComponent } from './time-editor.component';

@NgModule({
  declarations: [TimeEditorComponent],
  imports: [CommonModule, FormsModule],
  exports: [TimeEditorComponent]
})
export class TimeEditorModule { } 
