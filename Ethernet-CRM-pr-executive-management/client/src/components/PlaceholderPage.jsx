import React from 'react';

export default function PlaceholderPage({ title }) {
  return (
    <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
      <div className="p-4 bg-muted rounded-full">
        <span className="text-4xl">🚧</span>
      </div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground">This page is under construction as part of the redesign.</p>
    </div>
  );
}
