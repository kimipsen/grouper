import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SessionDetail } from './features/sessions/session-detail/session-detail';
import { SessionList } from './features/sessions/session-list/session-list';

const routes: Routes = [
  { path: '', redirectTo: '/sessions', pathMatch: 'full' },
  { path: 'sessions', component: SessionList },
  { path: 'session/:id', component: SessionDetail }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
