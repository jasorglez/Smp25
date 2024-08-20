import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './search.component.html',
  styleUrl: './search.component.scss'
})
export class SearchComponent {

  constructor(public router: Router) {

  }

  ngOnInit() {
    const today = new Date();
    this.lb = today.toISOString().substring(0, 10);
  }

  lb: string;
  currentDate: string;

  @Input() id: number | undefined;
  @Output() dataEmitter = new EventEmitter<{ id: number, date: string }>();

  buscar() {

    if (this.id != undefined && this.lb != undefined) {
      const data = { id: this.id, date: this.lb };
      this.dataEmitter.emit(data);
    }
  }

}
