# Lower Third  
Sample implementation of the CasparCG html template

## Installation
Requires Nodejs and npm
Run `npm i` to install dependencies

## Running
Either use a webserver, or run the built-in development server using `npm run dev`

## Accessing project
If the built-in http server is being used, you can access the project at http://localhost:8080/lower-third.1.html
To access the debug/dev widget, add `?debug=true` to the URL. This will load the debug widget. Here you can load data, preview animations etc

## Templating

In order to alter the HTML from CasparCG, you can use the `data-style-*` attribute for styling, and the elements' `id` attribute for content. 

### Example:

CasparCG data: 
```json
{"style": {"primaryColor": "#ff0000"}, "data": {"title": "World!"}}
```

HTML: 
```html
<div data-style-primaryColor="background-color"><h1 id="title">Hello,</h1></div>
```

Using the above data, the background color of the div will be set to the value of primaryColor `#ff0000`, and the title text to `World!`