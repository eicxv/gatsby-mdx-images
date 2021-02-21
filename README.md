## gatsby-mdx-images

A plugin for gatsby-plugin-mdx which transforms markdown image tags and html/jsx tags using gatsby-plugin-sharp. It is intended to be a more flexible alternative to gatsby-remark-images for mdx users. gatsby-mdx-images only works with local images, similarly to gatsby-remark-images.

```mdx
![alt text](../path/to/image.png "title text")
```

```mdx
<Img src="../path/to/image.png" alt="alt text" title="title text"></Img>
```

are both transformed to

```mdx
<Img
  fluid={{"aspectRatio" : 1.2,
          "base64" : "data:image/png;base64,base64encodedimage"
          "sizes" : "(max-width: 200px) 100vw, 200px",
          "src" : "/static/hash/image.png",
          "srcSet": "/static/hash/image.png 50w,
                     /static/hash/image.png 100w,
                     /static/hash/image.png 200w,
                     /static/hash/image.png 300w,
                     /static/hash/image.png 346w"
            }}
  alt="alt text"
  title="title text>
</Img>
```

## How to use

Add `gatsby-mdx-images` to the `gatsbyRemarkPlugins` array in the options of `gatsby-plugin-mdx`.

```javascript
// gatsby-config.js
module.exports = {
  plugins: [
    {
      resolve: "gatsby-plugin-mdx",
      options: {
        gatsbyRemarkPlugins: ["gatsby-mdx-images"],
      },
    },
  ],
};
```

Make sure that the jsx tag gatsby-mdx-images transforms to (defaults to `Img`) is available in the mdx file, either by importing directly or using [shortcodes](https://mdxjs.com/blog/shortcodes).

### Import image component

gatsby-mdx-images is designed to work with the [gatsby-image][gatsby-image] `Img` component. Make the image component available either by importing it in mdx or adding it as a shortcode. Of course you can also use own component with styling or custom behaviour.

```.mdx
import Img from "gatsby-image";
```

or more conveniently by adding the component as a shortcode.

```jsx
import Img from "gatsby-image";

export default function RenderMdx({ data }) {
  return (
    <MDXProvider components={{Img: Img}}>
      <MDXRenderer>{data.mdx.body}</MDXRenderer>
    </MDXProvider>
  )
```

## Options

There are two types of options, transformation options which influence how the AST is transformed and image options which change the images generated. Transformation options and image options can be set in gatsby-config.js but image options can also be overridden for individual images when using html/jsx syntax.

### Transformation options

| Transformation Options     | Default | Description                                                                                                                                                                               |
| -------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| elementName                | `Img`   | Name of element to transform from and to.                                                                                                                                                 |
| replaceMarkdownImageParent | `true`  | Replaces the default paragraph parent with a div. The reason for this option is that the Img component of gatsby-image uses divs to wrap the img and divs are not valid inside paragraphs |

### Image options

gatsby-plugin-sharps fluid function is used to generate images. Fixed images are not yet supported. Here are the most useful options which are used when generating fluid images.

| Fluid Options     | Default         |
| ----------------- | --------------- |
| maxWidth          | 800             |
| quality           | 80              |
| maxHeight         |                 |
| srcSetBreakpoints | []              |
| background        | 'rgba(0,0,0,1)' |
| base64Width       | 20              |

Further details and all available options can be found in [gatsby-plugin-sharp][gatsby-plugin-sharp#fluid].

The output options are intended to mirror the gatsby-transformer-sharp graphql fragments and govern which properties are passed on to the image.

| Output Options        | Default | Description                                        |
| --------------------- | ------- | -------------------------------------------------- |
| base64                | true    | Include base64 image for Blur up effect            |
| withWebp              | false   | Include webp versions                              |
| limitPresentationSize | false   | Limit displayed max height and width to image size |

Image options can be overridden on individual images by using jsx tags and passing in json as a string in the `mdx-image-options` property.

### Options example

```javascript
// gatsby-config.js
module.exports = {
  plugins: [
    {
      resolve: "gatsby-plugin-mdx",
      options: {
        gatsbyRemarkPlugins: [{
          resolve: "gatsby-mdx-images"
          options: {
            elementName: "Image",
            fluid: {
              maxWidth: 960,
              quality: 95,
              base64Width: 24
            },
            output: {
              withWebp: true
             }
          }
        }],
      },
    },
  ],
};
```

```mdx
![config options](../path/to/image.png "title text")

<Image
  src="../path/to/other-image.png"
  image-options="{"fluid": {"maxWidth": 1400}, "output": {"base64": false}}"
  alt="override options"
  title="title text">
</Image>
```

Both these images will be transformed into `Image` tags according to the `elementName` option in the config. The first image will be transformed using the defaults set in `gatsby-config.js` while the second image overrides some options.

[gatsby-image]: https://github.com/gatsbyjs/gatsby/tree/master/packages/gatsby-image
[gatsby-plugin-sharp#fluid]: https://github.com/gatsbyjs/gatsby/tree/master/packages/gatsby-plugin-sharp#fluid
